import assert from "assert";
import os from "os";
import path from "path";
import fs from "fs";
import _ from "lodash";
import { Disposable, window } from "vscode";
import { MetroLauncher } from "./metro";
import { Devtools } from "./devtools";
import { RadonInspectorBridge } from "./bridge";
import { DeviceBase } from "../devices/DeviceBase";
import { Logger } from "../Logger";
import {
  BuildError,
  BuildManager,
  BuildResult,
  createBuildConfig,
  inferBuildType,
} from "../builders/BuildManager";
import {
  AppPermissionType,
  DeviceSettings,
  StartupMessage,
  TouchPoint,
  DeviceButtonType,
  DeviceSessionState,
  NavigationHistoryItem,
  NavigationRoute,
  DeviceSessionStatus,
  FatalErrorDescriptor,
  DeviceRotation,
  InspectData,
} from "../common/Project";
import { throttle, throttleAsync } from "../utilities/throttle";
import { getTelemetryReporter } from "../utilities/telemetry";
import { CancelError, CancelToken } from "../utilities/cancelToken";
import { ToolKey } from "./tools";
import { ApplicationContext } from "./ApplicationContext";
import { watchProjectFiles } from "../utilities/watchProjectFiles";
import { OutputChannelRegistry } from "./OutputChannelRegistry";
import { Output } from "../common/OutputChannel";
import { ApplicationSession } from "./applicationSession";
import { DevicePlatform, DeviceSessionStore } from "../common/State";
import { ReloadAction } from "./DeviceSessionsManager";
import { StateManager } from "./StateManager";
import { FrameReporter } from "./FrameReporter";
import { ScreenCapture } from "./ScreenCapture";
import { disposeAll } from "../utilities/disposables";

const MAX_URL_HISTORY_SIZE = 20;
const CACHE_STALE_THROTTLE_MS = 10 * 1000; // 10 seconds

type RestartOptions = {
  forceClean: boolean;
};

export type DeviceSessionDelegate = {
  onStateChange(state: DeviceSessionState): void;
};

export class DeviceBootError extends Error {
  constructor(
    message: string,
    public readonly cause: unknown
  ) {
    super(message);
  }
}

export class DeviceSession implements Disposable {
  private disposables: Disposable[] = [];

  private isActive = false;
  private metro: MetroLauncher;
  private maybeBuildResult: BuildResult | undefined;
  private devtools: Devtools;
  private buildManager: BuildManager;
  private cancelToken: CancelToken = new CancelToken();
  private watchProjectSubscription: Disposable;
  private frameReporter: FrameReporter;
  private screenCapture: ScreenCapture;

  private status: DeviceSessionStatus = "starting";
  private startupMessage: StartupMessage = StartupMessage.InitializingDevice;
  private stageProgress: number | undefined;
  private fatalError: FatalErrorDescriptor | undefined;
  private navigationHistory: NavigationHistoryItem[] = [];
  private navigationRouteList: NavigationRoute[] = [];
  private navigationHomeTarget: NavigationHistoryItem | undefined;
  private isUsingStaleBuild = false;
  private isRecordingScreen = false;
  private applicationSession: ApplicationSession | undefined;

  private get buildResult() {
    if (!this.maybeBuildResult) {
      throw new Error("Expecting build to be ready");
    }
    return this.maybeBuildResult;
  }

  public get previewURL() {
    return this.device.previewURL;
  }

  public get platform(): DevicePlatform {
    return this.device.platform;
  }

  public get inspectorBridge(): RadonInspectorBridge {
    return this.devtools;
  }

  constructor(
    private readonly stateManager: StateManager<DeviceSessionStore>,
    private readonly applicationContext: ApplicationContext,
    private readonly device: DeviceBase,
    initialRotation: DeviceRotation,
    private readonly deviceSessionDelegate: DeviceSessionDelegate,
    private readonly outputChannelRegistry: OutputChannelRegistry
  ) {
    this.frameReporter = new FrameReporter(
      this.stateManager.getDerived("frameReporting"),
      this.device
    );
    this.disposables.push(this.frameReporter);

    this.screenCapture = new ScreenCapture(
      this.stateManager.getDerived("screenCapture"),
      this.device,
      this.applicationContext
    );
    this.disposables.push(this.screenCapture);

    this.devtools = this.makeDevtools();
    this.metro = new MetroLauncher(this.devtools);
    this.metro.onBundleProgress(({ bundleProgress }) => this.onBundleProgress(bundleProgress));

    this.buildManager = this.applicationContext.buildManager;

    this.watchProjectSubscription = watchProjectFiles(this.onProjectFilesChanged);
    this.device.sendRotate(initialRotation);

    this.disposables.push(this.stateManager);
  }

  public getState(): DeviceSessionState {
    const commonState = {
      navigationHistory: this.navigationHistory,
      navigationRouteList: this.navigationRouteList,
      deviceInfo: this.device.deviceInfo,
      previewURL: this.previewURL,
      isUsingStaleBuild: this.isUsingStaleBuild,
      isRecordingScreen: this.isRecordingScreen,
    };
    if (this.status === "starting") {
      return {
        ...commonState,
        status: "starting",
        startupMessage: this.startupMessage,
        stageProgress: this.stageProgress,
      };
    } else if (this.status === "running") {
      const applicationState = this.applicationSession!.state;
      return {
        ...commonState,
        status: "running",
        ...applicationState,
      };
    } else if (this.status === "fatalError") {
      assert(this.fatalError, "Expected error to be defined in fatal error state");
      return {
        ...commonState,
        status: "fatalError",
        error: this.fatalError,
      };
    }
    assert(false, "Unexpected device session status: " + this.status);
  }

  private resetStartingState(startupMessage: StartupMessage = StartupMessage.Restarting) {
    this.status = "starting";
    this.startupMessage = startupMessage;
    this.stageProgress = undefined;
    this.fatalError = undefined;
    this.isUsingStaleBuild = false;
    this.navigationHomeTarget = undefined;
    this.emitStateChange();
  }

  private updateStartupMessage(startupMessage: StartupMessage) {
    this.startupMessage = startupMessage;
    this.stageProgress = undefined;
    this.emitStateChange();
  }

  private async isBuildStale(build: BuildResult) {
    const buildType = await inferBuildType(this.platform, this.applicationContext.launchConfig);
    const currentBuildConfig = createBuildConfig(
      this.device,
      this.applicationContext.launchConfig,
      buildType
    );
    const currentFingerprint =
      await this.buildManager.calculateBuildFingerprint(currentBuildConfig);
    return currentFingerprint !== build.fingerprint;
  }

  private onProjectFilesChanged = throttleAsync(async () => {
    const lastSuccessfulBuild = this.maybeBuildResult;
    if (!lastSuccessfulBuild || this.status !== "running") {
      // we only monitor for stale builds when the session is in 'running' state
      return;
    }
    if (await this.isBuildStale(lastSuccessfulBuild)) {
      this.isUsingStaleBuild = true;
      this.emitStateChange();
    }
  }, CACHE_STALE_THROTTLE_MS);

  //#region Metro delegate methods

  onBundleProgress = throttle((stageProgress: number) => {
    if (this.startupMessage === StartupMessage.WaitingForAppToLoad) {
      this.stageProgress = stageProgress;
      this.emitStateChange();
    }
  }, 100);

  //#endregion

  private makeDevtools() {
    const devtools = new Devtools();
    devtools.onEvent("appReady", () => {
      this.device.setUpKeyboard();
      Logger.debug("App ready");
    });
    // We don't need to store event disposables here as they are tied to the lifecycle
    // of the devtools instance, which is disposed when we recreate the devtools or
    // when the device session is disposed
    devtools.onEvent("navigationChanged", (payload: NavigationHistoryItem) => {
      if (!this.navigationHomeTarget) {
        this.navigationHomeTarget = payload;
      }
      this.navigationHistory = [
        payload,
        ...this.navigationHistory.filter((record) => record.id !== payload.id),
      ].slice(0, MAX_URL_HISTORY_SIZE);
      this.emitStateChange();
    });
    devtools.onEvent("navigationRouteListUpdated", (payload: NavigationRoute[]) => {
      this.navigationRouteList = payload;
      this.emitStateChange();
    });
    return devtools;
  }

  /**
  This method is async to allow for awaiting it during restarts, please keep in mind tho that
  build in vscode dispose system ignores async keyword and works synchronously.
  */
  public async dispose() {
    this.cancelToken?.cancel();
    await this.deactivate();

    await this.applicationSession?.dispose();
    this.applicationSession = undefined;

    this.device?.dispose();
    this.metro?.dispose();
    this.devtools?.dispose();
    this.watchProjectSubscription.dispose();

    disposeAll(this.disposables);
  }

  public async activate() {
    if (!this.isActive) {
      this.isActive = true;
      await this.applicationSession?.activate();
    }
  }

  public async deactivate() {
    if (this.isActive) {
      this.isActive = false;
      await this.applicationSession?.deactivate();
    }
  }

  private cancelOngoingOperations() {
    this.cancelToken.cancel();
    this.cancelToken = new CancelToken();
  }

  public async performReloadAction(type: ReloadAction): Promise<void> {
    try {
      this.resetStartingState();

      getTelemetryReporter().sendTelemetryEvent("url-bar:reload-requested", {
        platform: this.platform,
        method: type,
      });
      await this.performReloadActionInternal(type);
      this.status = "running";
      this.emitStateChange();
    } catch (e) {
      if (e instanceof CancelError) {
        // reload got cancelled, we don't show any errors
        return;
      } else if (e instanceof BuildError) {
        this.status = "fatalError";
        this.fatalError = {
          kind: "build",
          message: e.message,
          buildType: e.buildType,
          platform: this.platform,
        };
        this.emitStateChange();
        return;
      }
      Logger.error("Failed to perform reload action", type, e);
      throw e;
    }
  }

  private async performReloadActionInternal(type: ReloadAction): Promise<void> {
    try {
      switch (type) {
        case "autoReload":
          await this.autoReload();
          return;
        case "reboot":
          await this.restartDevice({ forceClean: false });
          return;
        case "clearMetro":
          await this.restartMetro({ resetCache: true });
          return;
        case "rebuild":
          await this.restartDevice({ forceClean: true });
          return;
        case "reinstall":
          await this.reinstallApp();
          return;
        case "restartProcess":
          await this.restartProcess();
          return;
        case "reloadJs":
          await this.reloadJS();
          return;
        case "restartMetro":
          await this.restartMetro({ resetCache: true });
          return;
      }
    } catch (e) {
      Logger.debug("[Reload]", e);
      throw e;
    }
  }

  private async restartMetro({ resetCache }: { resetCache: boolean }) {
    this.cancelOngoingOperations();
    const cancelToken = this.cancelToken;

    this.updateStartupMessage(StartupMessage.StartingPackager);
    const oldMetro = this.metro;
    this.metro = new MetroLauncher(this.devtools);
    this.metro.onBundleProgress(({ bundleProgress }) => this.onBundleProgress(bundleProgress));
    oldMetro.dispose();

    Logger.debug(`Launching metro`);
    await this.metro.start({
      resetCache,
      launchConfiguration: this.applicationContext.launchConfig,
      dependencies: [],
    });

    this.applicationSession?.dispose();
    this.applicationSession = undefined;
    if (!this.maybeBuildResult) {
      await this.buildApp({ clean: false, cancelToken });
    }
    await cancelToken.adapt(this.installApp({ reinstall: false }));
    await this.launchApp(cancelToken);
    Logger.debug("Metro restarted");
  }

  private async reloadJS() {
    if (this.applicationSession === undefined) {
      throw new Error(
        "JS bundle cannot be reloaded before an application is launched and connected to Radon"
      );
    }
    this.updateStartupMessage(StartupMessage.WaitingForAppToLoad);
    await this.applicationSession.reloadJS();
  }

  private async reinstallApp() {
    this.cancelOngoingOperations();
    const cancelToken = this.cancelToken;

    this.updateStartupMessage(StartupMessage.Installing);

    await this.stopApp();
    await cancelToken.adapt(this.installApp({ reinstall: true }));
    await this.launchApp(cancelToken);
  }

  private async restartProcess() {
    this.cancelOngoingOperations();
    const cancelToken = this.cancelToken;

    this.updateStartupMessage(StartupMessage.Launching);

    await this.stopApp();
    await this.launchApp(cancelToken);
  }

  private async restartDevice({ forceClean }: RestartOptions) {
    this.cancelOngoingOperations();
    const cancelToken = this.cancelToken;

    this.updateStartupMessage(StartupMessage.InitializingDevice);
    await this.stopApp();

    this.updateStartupMessage(StartupMessage.BootingDevice);
    await cancelToken.adapt(this.device.reboot());
    await cancelToken.adapt(this.device.startPreview());

    await this.buildApp({
      clean: forceClean,
      cancelToken,
    });
    await this.installApp({ reinstall: false });
    await this.launchApp(cancelToken);
    Logger.debug("Device session started");
  }

  private async autoReload() {
    getTelemetryReporter().sendTelemetryEvent("url-bar:restart-requested", {
      platform: this.platform,
    });

    this.resetStartingState();
    if (this.maybeBuildResult && (await this.isBuildStale(this.maybeBuildResult))) {
      await this.restartDevice({ forceClean: false });
      return;
    }

    // if reloading JS is possible, we try to do it first and exit in case of success
    // otherwise we continue to restart using more invasive methods
    try {
      await this.reloadJS();
      return;
    } catch (e) {
      if (e instanceof CancelError) {
        // when reload is cancelled, we don't want to fallback into
        // restarting the session again
        return;
      }
      Logger.debug("Reloading JS failed, falling back to restarting the application");
    }

    try {
      await this.restartProcess();
      this.status = "running";
      this.emitStateChange();
      return;
    } catch (e) {
      if (e instanceof CancelError) {
        // when restart process is cancelled, we don't want to fallback into
        // restarting the session again
        return;
      }
    }

    // finally in case of any errors, the last resort is performing project
    // restart and device selection (we still avoid forcing clean builds, and
    // only do clean build when explicitly requested).
    // before doing anything, we check if the device hasn't been updated in the meantime
    // which might have initiated a new session anyway
    await this.restartDevice({ forceClean: false });
  }

  private async launchApp(cancelToken: CancelToken) {
    const launchRequestTime = Date.now();
    getTelemetryReporter().sendTelemetryEvent("app:launch:requested", {
      platform: this.platform,
    });

    const applicationSessionPromise = ApplicationSession.launch(
      {
        applicationContext: this.applicationContext,
        device: this.device,
        buildResult: this.buildResult,
        metro: this.metro,
        devtools: this.devtools,
      },
      () => this.isActive,
      this.updateStartupMessage.bind(this),
      cancelToken
    ).then(async (applicationSession) => {
      if (cancelToken.cancelled) {
        applicationSession.dispose();
        throw new CancelError("Application launch was cancelled");
      }

      this.applicationSession = applicationSession;
      applicationSession.onStateChanged(() => this.emitStateChange());
      this.status = "running";
      this.emitStateChange();

      const launchDurationSec = (Date.now() - launchRequestTime) / 1000;
      Logger.info("App launched in", launchDurationSec.toFixed(2), "sec.");
      getTelemetryReporter().sendTelemetryEvent(
        "app:launch:completed",
        { platform: this.platform },
        { durationSec: launchDurationSec }
      );
    });

    const launchConfig = this.applicationContext.launchConfig;
    const shouldWaitForAppLaunch = launchConfig.preview.waitForAppLaunch;
    const waitForAppReady = shouldWaitForAppLaunch ? applicationSessionPromise : Promise.resolve();

    if (shouldWaitForAppLaunch) {
      const reportWaitingStuck = setTimeout(() => {
        Logger.info(
          "App is taking very long to boot up, it might be stuck. Device preview URL:",
          this.device.previewURL
        );
        getTelemetryReporter().sendTelemetryEvent("app:launch:waiting-stuck", {
          platform: this.platform,
        });
      }, 30000);
      waitForAppReady
        .then(() => clearTimeout(reportWaitingStuck))
        .catch(() => {
          // ignore errors here
        });
    }

    await waitForAppReady;
  }

  private async stopApp() {
    if (this.applicationSession) {
      await this.applicationSession.dispose();
      this.applicationSession = undefined;
    }
  }

  private async bootDevice() {
    this.updateStartupMessage(StartupMessage.BootingDevice);
    try {
      await this.device.bootDevice();
    } catch (e) {
      Logger.error("Failed to boot device", e);
      throw new DeviceBootError("Failed to boot device", e);
    }
  }

  /**
   * Returns true if some native build dependencies have change and we should perform
   * a native build despite the fact the fingerprint indicates we don't need to.
   * This is currently only used for the scenario when we detect that pods need
   * to be reinstalled for iOS.
   */
  private async checkBuildDependenciesChanged(platform: DevicePlatform): Promise<boolean> {
    const dependencyManager = this.applicationContext.applicationDependencyManager;
    if (platform === DevicePlatform.IOS) {
      return !(await dependencyManager.checkPodsInstallationStatus());
    }
    return false;
  }

  private async buildApp({ clean, cancelToken }: { clean: boolean; cancelToken: CancelToken }) {
    const buildStartTime = Date.now();
    this.updateStartupMessage(StartupMessage.Building);
    this.maybeBuildResult = undefined;
    const launchConfiguration = this.applicationContext.launchConfig;
    const buildType = await inferBuildType(this.platform, launchConfiguration);

    // Native build dependencies when changed, should invalidate cached build (even if the fingerprint is the same)
    const buildDependenciesChanged = await this.checkBuildDependenciesChanged(this.platform);

    const buildConfig = createBuildConfig(this.device, launchConfiguration, buildType);

    const buildOptions = {
      forceCleanBuild: clean || buildDependenciesChanged,
      buildOutputChannel: this.outputChannelRegistry.getOrCreateOutputChannel(
        this.platform === DevicePlatform.IOS ? Output.BuildIos : Output.BuildAndroid
      ),
      cancelToken,
      progressListener: throttle((stageProgress: number) => {
        if (this.startupMessage === StartupMessage.Building) {
          this.stageProgress = stageProgress;
          this.emitStateChange();
        }
      }, 100),
    };

    const dependencyManager = this.applicationContext.applicationDependencyManager;
    await dependencyManager.ensureDependenciesForBuild(buildConfig, buildOptions);

    this.isUsingStaleBuild = false;
    this.maybeBuildResult = await this.buildManager.buildApp(buildConfig, buildOptions);
    const buildDurationSec = (Date.now() - buildStartTime) / 1000;
    Logger.info("Build completed in", buildDurationSec.toFixed(2), "sec.");
    getTelemetryReporter().sendTelemetryEvent(
      "build:completed",
      {
        platform: this.platform,
      },
      { durationSec: buildDurationSec }
    );
  }

  private async installApp({ reinstall }: { reinstall: boolean }) {
    this.updateStartupMessage(StartupMessage.Installing);
    return this.device.installApp(this.buildResult, reinstall);
  }

  private async waitForMetroReady() {
    this.updateStartupMessage(StartupMessage.StartingPackager);
    // wait for metro/devtools to start before we continue
    await Promise.all([this.metro.ready(), this.devtools.ready()]);
    Logger.debug("Metro & devtools ready");
  }

  public async start() {
    try {
      this.resetStartingState(StartupMessage.InitializingDevice);

      this.cancelOngoingOperations();
      const cancelToken = this.cancelToken;

      const packageManagerOutputChannel = this.outputChannelRegistry.getOrCreateOutputChannel(
        Output.PackageManager
      );

      const waitForNodeModules =
        this.applicationContext.applicationDependencyManager.ensureDependenciesForStart(
          packageManagerOutputChannel,
          cancelToken
        );

      Logger.debug(`Launching devtools`);
      this.devtools.start();

      Logger.debug(`Launching metro`);
      this.metro.start({
        resetCache: false,
        launchConfiguration: this.applicationContext.launchConfig,
        dependencies: [waitForNodeModules],
      });

      await cancelToken.adapt(this.waitForMetroReady());
      await cancelToken.adapt(this.bootDevice());
      await this.buildApp({
        clean: false,
        cancelToken,
      });
      await cancelToken.adapt(this.installApp({ reinstall: false }));
      await this.device.startPreview();
      await this.launchApp(cancelToken);
      Logger.debug("Device session started");
    } catch (e) {
      if (e instanceof CancelError) {
        Logger.info("Device selection was canceled", e);
      } else if (e instanceof DeviceBootError) {
        this.status = "fatalError";
        this.fatalError = {
          kind: "device",
          message: e.message,
        };
      } else if (e instanceof BuildError) {
        this.status = "fatalError";
        this.fatalError = {
          kind: "build",
          message: e.message,
          buildType: e.buildType,
          platform: this.platform,
        };
      } else {
        this.status = "fatalError";
        this.fatalError = {
          kind: "build",
          message: (e as Error).message,
          buildType: null,
          platform: this.platform,
        };
      }
      throw e;
    } finally {
      this.emitStateChange();
    }
  }

  private emitStateChange() {
    this.deviceSessionDelegate.onStateChange(this.getState());
  }

  public async resetAppPermissions(permissionType: AppPermissionType) {
    if (this.maybeBuildResult) {
      return this.device.resetAppPermissions(permissionType, this.maybeBuildResult);
    }
    return false;
  }

  public async sendDeepLink(link: string, terminateApp: boolean) {
    if (this.maybeBuildResult) {
      if (terminateApp) {
        const packageNameOrBundleID =
          this.maybeBuildResult.platform === DevicePlatform.Android
            ? this.maybeBuildResult.packageName
            : this.maybeBuildResult.bundleID;

        await this.device.terminateApp(packageNameOrBundleID);
      }

      await this.device.sendDeepLink(link, this.maybeBuildResult, terminateApp);
    }
  }

  public startReportingFrameRate() {
    this.frameReporter.startReportingFrameRate();
  }

  public stopReportingFrameRate() {
    this.frameReporter.stopReportingFrameRate();
  }

  // #region Recording

  public async toggleRecording() {
    this.screenCapture.toggleRecording();
  }

  public startRecording() {
    this.screenCapture.startRecording();
  }

  public async captureAndStopRecording() {
    this.screenCapture.captureAndStopRecording();
  }

  public async captureReplay() {
    this.screenCapture.captureReplay();
  }

  public async captureScreenshot() {
    this.screenCapture.captureScreenshot();
  }

  public async getScreenshot() {
    return this.screenCapture.getScreenshot();
  }

  public get previewReady() {
    return this.device.previewReady;
  }

  public get deviceRotation() {
    return this.device.rotation;
  }

  // #endregion Recording

  public sendTouches(
    touches: Array<TouchPoint>,
    type: "Up" | "Move" | "Down",
    rotation: DeviceRotation
  ) {
    this.device.sendTouches(touches, type, rotation);
  }

  public sendKey(keyCode: number, direction: "Up" | "Down") {
    this.device.sendKey(keyCode, direction);
  }

  public sendButton(button: DeviceButtonType, direction: "Up" | "Down") {
    this.device.sendButton(button, direction);
  }

  public sendClipboard(text: string) {
    return this.device.sendClipboard(text);
  }

  public sendRotate(rotation: DeviceRotation) {
    this.device.sendRotate(rotation);
    this.emitStateChange();
  }

  public async getClipboard() {
    return this.device.getClipboard();
  }

  public sendWheel(point: TouchPoint, deltaX: number, deltaY: number) {
    this.device.sendWheel(point, deltaX, deltaY);
  }

  public inspectElementAt(
    xRatio: number,
    yRatio: number,
    requestStack: boolean
  ): Promise<InspectData> {
    if (!this.applicationSession) {
      throw new Error("Cannot inspect element while the application is not running");
    }
    return this.applicationSession.inspectElementAt(xRatio, yRatio, requestStack);
  }

  public openNavigation(id: string) {
    this.inspectorBridge.sendOpenNavigationRequest(id);
  }

  public navigateHome() {
    if (this.navigationHomeTarget) {
      this.inspectorBridge.sendOpenNavigationRequest(this.navigationHomeTarget.id);
    }
  }

  public navigateBack() {
    this.inspectorBridge.sendOpenNavigationRequest("__BACK__");
  }

  public removeNavigationHistoryEntry(id: string) {
    this.navigationHistory = this.navigationHistory.filter((record) => record.id !== id);
    this.emitStateChange();
  }

  public async openDevMenu() {
    await this.metro.openDevMenu();
  }

  public async startPreview(previewId: string) {
    const { resolve, reject, promise } = Promise.withResolvers<void>();
    const listener = this.devtools.onEvent("openPreviewResult", (payload) => {
      if (payload.previewId === previewId) {
        listener.dispose();
        if (payload.error) {
          reject(payload.error);
        } else {
          resolve();
        }
      }
    });
    this.inspectorBridge.sendOpenPreviewRequest(previewId);
    return promise;
  }

  public async updateDeviceSettings(settings: DeviceSettings): Promise<boolean> {
    return this.device.updateDeviceSettings(settings);
  }

  public async sendBiometricAuthorization(isMatch: boolean) {
    await this.device.sendBiometricAuthorization(isMatch);
  }

  public openStorybookStory(componentTitle: string, storyName: string) {
    this.inspectorBridge.sendShowStorybookStoryRequest(componentTitle, storyName);
  }

  //#region Application Session

  public async updateToolEnabledState(toolName: ToolKey, enabled: boolean) {
    this.applicationSession?.updateToolEnabledState(toolName, enabled);
  }

  public resumeDebugger() {
    this.applicationSession?.resumeDebugger();
  }

  public stepOverDebugger() {
    this.applicationSession?.stepOverDebugger();
  }
  public stepOutDebugger() {
    this.applicationSession?.stepOutDebugger();
  }
  public stepIntoDebugger() {
    this.applicationSession?.stepIntoDebugger();
  }

  public async startProfilingCPU() {
    await this.applicationSession?.startProfilingCPU();
  }

  public async stopProfilingCPU() {
    await this.applicationSession?.stopProfilingCPU();
  }

  public async startProfilingReact() {
    await this.applicationSession?.startProfilingReact();
  }

  public async stopProfilingReact() {
    return await this.applicationSession?.stopProfilingReact();
  }

  public openTool(toolName: ToolKey) {
    this.applicationSession?.openTool(toolName);
  }

  public getPlugin(toolName: ToolKey) {
    return this.applicationSession?.getPlugin(toolName);
  }

  public resetLogCounter() {
    this.applicationSession?.resetLogCounter();
  }
  //#endregion

  public getMetroPort() {
    return this.metro.port;
  }

  public sendFile(filePath: string) {
    getTelemetryReporter().sendTelemetryEvent("device:send-file", {
      platform: this.device.deviceInfo.platform,
      extension: path.extname(filePath),
    });
    return this.device.sendFile(filePath);
  }

  public async openSendFileDialog() {
    const pickerResult = await window.showOpenDialog({
      canSelectMany: true,
      canSelectFolders: false,
      title: "Select files to send to device",
    });
    if (!pickerResult) {
      throw new Error("No files selected");
    }
    const sendFilePromises = pickerResult.map((fileUri) => {
      return this.sendFile(fileUri.fsPath);
    });
    await Promise.all(sendFilePromises);
  }

  public async sendFileToDevice(fileName: string, data: ArrayBuffer): Promise<void> {
    let canSafelyRemove = true;
    const tempDir = await this.getTemporaryFilesDirectory();
    const tempFileLocation = path.join(tempDir, fileName);
    try {
      await fs.promises.writeFile(tempFileLocation, new Uint8Array(data));
      const result = await this.sendFile(tempFileLocation);
      canSafelyRemove = result.canSafelyRemove;
    } finally {
      if (canSafelyRemove) {
        // NOTE: no need to await this, it can run in the background
        fs.promises.rm(tempFileLocation, { force: true }).catch((_e) => {
          // NOTE: we can ignore errors here, as the file might not exist
        });
      }
    }
  }

  private tempDir: string | undefined;
  /**
   * Returns the path to a temporary directory, creating it if it does not already exist.
   * The directory is created using the system's temporary directory and is cleaned up
   * automatically when the device session is disposed. Subsequent calls return the same directory path.
   *
   * @returns {Promise<string>} The path to the temporary directory.
   */
  private async getTemporaryFilesDirectory(): Promise<string> {
    if (this.tempDir === undefined) {
      const tempDir = await fs.promises.mkdtemp(os.tmpdir());
      this.tempDir = tempDir;
      this.disposables.push(
        new Disposable(() => {
          fs.promises.rm(tempDir, { recursive: true }).catch((_e) => {
            /* silence the errors, it's fine */
          });
        })
      );
    }
    return this.tempDir;
  }
}
