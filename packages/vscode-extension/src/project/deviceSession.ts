import assert from "assert";
import _ from "lodash";
import { Disposable } from "vscode";
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
import { BuildCache } from "../builders/BuildCache";
import { watchProjectFiles } from "../utilities/watchProjectFiles";
import { OutputChannelRegistry } from "./OutputChannelRegistry";
import { Output } from "../common/OutputChannel";
import { ApplicationSession } from "./applicationSession";
import { DevicePlatform, FramerateReport } from "../common/State";
import { ReloadAction } from "./DeviceSessionsManager";

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
  private isActive = false;
  private metro: MetroLauncher;
  private maybeBuildResult: BuildResult | undefined;
  private devtools: Devtools;
  private buildManager: BuildManager;
  private buildCache: BuildCache;
  private cancelToken: CancelToken = new CancelToken();
  private watchProjectSubscription: Disposable;

  private status: DeviceSessionStatus = "starting";
  private startupMessage: StartupMessage = StartupMessage.InitializingDevice;
  private stageProgress: number | undefined;
  private fatalError: FatalErrorDescriptor | undefined;
  private navigationHistory: NavigationHistoryItem[] = [];
  private navigationRouteList: NavigationRoute[] = [];
  private navigationHomeTarget: NavigationHistoryItem | undefined;
  private hasStaleBuildCache = false;
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
    private readonly applicationContext: ApplicationContext,
    private readonly device: DeviceBase,
    initialRotation: DeviceRotation,
    private readonly deviceSessionDelegate: DeviceSessionDelegate,
    private readonly outputChannelRegistry: OutputChannelRegistry
  ) {
    this.devtools = this.makeDevtools();
    this.metro = new MetroLauncher(this.devtools);
    this.metro.onBundleProgress(({ bundleProgress }) => this.onBundleProgress(bundleProgress));

    this.buildCache = this.applicationContext.buildCache;
    this.buildManager = this.applicationContext.buildManager;

    this.watchProjectSubscription = watchProjectFiles(this.onProjectFilesChanged);
    this.device.sendRotate(initialRotation);
  }

  public getState(): DeviceSessionState {
    const commonState = {
      navigationHistory: this.navigationHistory,
      navigationRouteList: this.navigationRouteList,
      deviceInfo: this.device.deviceInfo,
      previewURL: this.previewURL,
      hasStaleBuildCache: this.hasStaleBuildCache,
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
    this.hasStaleBuildCache = false;
    this.navigationHomeTarget = undefined;
    this.emitStateChange();
  }

  private updateStartupMessage(startupMessage: StartupMessage) {
    this.startupMessage = startupMessage;
    this.stageProgress = undefined;
    this.emitStateChange();
  }

  private onProjectFilesChanged = throttleAsync(async () => {
    const appRoot = this.applicationContext.appRootFolder;
    const launchConfig = this.applicationContext.launchConfig;
    const hasCachedBuild = this.applicationContext.buildCache.hasCachedBuild({
      platform: this.platform,
      appRoot,
      env: launchConfig.env,
    });
    const platformKey: "ios" | "android" = this.platform === DevicePlatform.IOS ? "ios" : "android";
    const fingerprintCommand = launchConfig.customBuild?.[platformKey]?.fingerprintCommand;
    if (hasCachedBuild) {
      const fingerprint = await this.applicationContext.buildCache.calculateFingerprint({
        appRoot,
        env: launchConfig.env,
        fingerprintCommand,
      });
      const isCacheStale = await this.applicationContext.buildCache.isCacheStale(fingerprint, {
        platform: this.platform,
        appRoot,
        env: launchConfig.env,
      });

      if (isCacheStale) {
        this.onCacheStale();
      }
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

  onCacheStale = () => {
    if (this.status === "running") {
      // we only consider "stale cache" in a non-error state that happens
      // after the launch phase if complete. Otherwsie, it may be a result of
      // the build process that triggers the callback in which case we don't want
      // to warn users about it.
      this.hasStaleBuildCache = true;
      this.emitStateChange();
    }
  };

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
    this.watchProjectSubscription.dispose();

    await this.applicationSession?.dispose();
    this.applicationSession = undefined;

    this.device?.dispose();
    this.metro?.dispose();
    this.devtools?.dispose();
    this.watchProjectSubscription.dispose();
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

    const launchConfig = this.applicationContext.launchConfig;
    const platformKey = this.platform === DevicePlatform.IOS ? "ios" : "android";
    const fingerprintOptions = {
      appRoot: this.applicationContext.appRootFolder,
      env: launchConfig.env,
      fingerprintCommand: launchConfig.customBuild?.[platformKey]?.fingerprintCommand,
    };

    this.resetStartingState();
    const currentFingerprint = await this.buildCache.calculateFingerprint(fingerprintOptions);
    if (
      await this.buildCache.isCacheStale(currentFingerprint, {
        platform: this.platform,
        appRoot: this.applicationContext.appRootFolder,
        env: launchConfig.env,
      })
    ) {
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

    const buildConfig = createBuildConfig(
      this.platform,
      clean || buildDependenciesChanged,
      launchConfiguration,
      buildType
    );
    const buildOutputChannel = this.outputChannelRegistry.getOrCreateOutputChannel(
      this.platform === DevicePlatform.IOS ? Output.BuildIos : Output.BuildAndroid
    );

    const dependencyManager = this.applicationContext.applicationDependencyManager;
    await dependencyManager.ensureDependenciesForBuild(
      buildConfig,
      buildOutputChannel,
      cancelToken
    );

    this.hasStaleBuildCache = false;
    this.maybeBuildResult = await this.buildManager.buildApp(buildConfig, {
      progressListener: throttle((stageProgress: number) => {
        if (this.startupMessage === StartupMessage.Building) {
          this.stageProgress = stageProgress;
          this.emitStateChange();
        }
      }, 100),
      cancelToken,
      buildOutputChannel,
    });
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

  public startFrameRateReporting(onFpsReport: (report: FramerateReport) => void) {
    this.device.startFrameRateReporting(onFpsReport);
  }

  public stopFrameRateReporting() {
    this.device.stopFrameRateReporting();
  }

  public startRecording() {
    this.isRecordingScreen = true;
    this.emitStateChange();
    return this.device.startRecording();
  }

  public async captureAndStopRecording(rotation: DeviceRotation) {
    this.isRecordingScreen = false;
    this.emitStateChange();
    return this.device.captureAndStopRecording(rotation);
  }

  public async captureReplay(rotation: DeviceRotation) {
    return this.device.captureReplay(rotation);
  }

  public async captureScreenshot(rotation: DeviceRotation) {
    return this.device.captureScreenshot(rotation);
  }

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

  //#region Methods delegated to Application Session
  public async updateToolEnabledState(toolName: ToolKey, enabled: boolean) {
    this.applicationSession?.updateToolEnabledState(toolName, enabled);
  }

  public resumeDebugger() {
    this.applicationSession?.resumeDebugger();
  }

  public stepOverDebugger() {
    this.applicationSession?.stepOverDebugger();
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
}
