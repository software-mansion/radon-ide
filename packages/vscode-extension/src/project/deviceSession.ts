import { Disposable } from "vscode";
import { throttle } from "lodash";
import { RadonInspectorBridge } from "./inspectorBridge";
import { DeviceBase } from "../devices/DeviceBase";
import { Logger } from "../Logger";
import {
  BuildError,
  BuildManager,
  BuildResult,
  createBuildConfig,
  inferBuildType,
} from "../builders/BuildManager";
import { AppPermissionType, TouchPoint, DeviceButtonType, InspectData } from "../common/Project";
import { throttleAsync } from "../utilities/throttle";
import { getTelemetryReporter } from "../utilities/telemetry";
import { CancelError, CancelToken } from "../utilities/cancelToken";
import { ToolKey } from "./tools";
import { ApplicationContext } from "./ApplicationContext";
import { watchProjectFiles } from "../utilities/watchProjectFiles";
import { OutputChannelRegistry } from "./OutputChannelRegistry";
import { Output } from "../common/OutputChannel";
import { ApplicationSession } from "./applicationSession";
import {
  DevicePlatform,
  DeviceRotation,
  DeviceSessionStore,
  DeviceSettings,
  InstallationError,
  NavigationState,
  RecursivePartial,
  REMOVE,
  StartupMessage,
} from "../common/State";
import { ReloadAction } from "./DeviceSessionsManager";
import { StateManager } from "./StateManager";
import { FrameReporter } from "./FrameReporter";
import { ScreenCapture } from "./ScreenCapture";
import { disposeAll } from "../utilities/disposables";
import { FileTransfer } from "./FileTransfer";
import { DevtoolsServer } from "./devtools";
import { MetroError, MetroProvider, MetroSession } from "./metro";

const CACHE_STALE_THROTTLE_MS = 10 * 1000; // 10 seconds

function isOfEnumDeviceRotation(value: unknown): value is DeviceRotation {
  return Object.values(DeviceRotation).includes(value as DeviceRotation);
}

type RestartOptions = {
  forceClean: boolean;
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

  private applicationSession: ApplicationSession | undefined;
  private metro: (MetroSession & Disposable) | undefined;
  private maybeBuildResult: BuildResult | undefined;
  private buildManager: BuildManager;
  private cancelToken: CancelToken = new CancelToken();
  private deviceSettingsStateManager: StateManager<DeviceSettings>;
  private frameReporter: FrameReporter;
  private navigationStateManager: StateManager<NavigationState>;
  private screenCapture: ScreenCapture;

  private isActive = false;

  public fileTransfer: FileTransfer;

  private get buildResult() {
    if (!this.maybeBuildResult) {
      throw new Error("Expecting build to be ready");
    }
    return this.maybeBuildResult;
  }

  public get id(): string {
    return this.stateManager.getState().deviceInfo.id;
  }

  public get inspectorBridge(): RadonInspectorBridge | undefined {
    return this.applicationSession?.inspectorBridge;
  }

  public get platform(): DevicePlatform {
    return this.stateManager.getState().deviceInfo.platform;
  }

  constructor(
    private readonly stateManager: StateManager<DeviceSessionStore>,
    private readonly applicationContext: ApplicationContext,
    private readonly device: DeviceBase,
    private readonly devtoolsServer: (DevtoolsServer & { port: number }) | undefined,
    initialRotation: DeviceRotation,
    private readonly outputChannelRegistry: OutputChannelRegistry,
    private readonly metroProvider: MetroProvider
  ) {
    this.deviceSettingsStateManager =
      applicationContext.workspaceConfigState.getDerived("deviceSettings");
    this.disposables.push(this.deviceSettingsStateManager);

    this.disposables.push(
      this.deviceSettingsStateManager.onSetState(async (partialState) => {
        const deviceSettings = this.deviceSettingsStateManager.getState();

        const changes = Object.keys(partialState);

        getTelemetryReporter().sendTelemetryEvent("device-settings:update-device-settings", {
          platform: this.platform,
          changedSetting: JSON.stringify(changes),
        });

        let needsRestart = await this.device.updateDeviceSettings(deviceSettings);

        if (needsRestart) {
          await this.performReloadAction("reboot");
        }
      })
    );

    this.disposables.push(
      this.deviceSettingsStateManager.onSetState(
        (partialState: RecursivePartial<DeviceSettings>) => {
          const deviceRotation =
            partialState.deviceRotation !== REMOVE ? partialState.deviceRotation : undefined;
          if (!deviceRotation) {
            return;
          }

          const deviceRotationResult = isOfEnumDeviceRotation(deviceRotation)
            ? deviceRotation
            : DeviceRotation.Portrait;
          this.device.sendRotate(deviceRotationResult);
        }
      )
    );

    this.frameReporter = new FrameReporter(
      this.stateManager.getDerived("frameReporting"),
      this.device
    );
    this.disposables.push(this.frameReporter);

    this.navigationStateManager = this.stateManager.getDerived("navigationState");
    this.disposables.push(this.navigationStateManager);

    this.screenCapture = new ScreenCapture(
      this.stateManager.getDerived("screenCapture"),
      this.device,
      this.applicationContext
    );
    this.disposables.push(this.screenCapture);

    this.buildManager = this.applicationContext.buildManager;

    this.disposables.push(watchProjectFiles(this.checkIsUsingStaleBuild));
    this.device.sendRotate(initialRotation);

    this.disposables.push(this.stateManager);

    this.fileTransfer = new FileTransfer(stateManager.getDerived("fileTransfer"), device);
    this.disposables.push(this.fileTransfer);
  }

  private resetStartingState(startupMessage: StartupMessage = StartupMessage.Restarting) {
    this.stateManager.updateState({
      status: "starting",
      startupMessage,
      stageProgress: 0,
    });
  }

  private updateStartupMessage(startupMessage: StartupMessage) {
    this.stateManager.updateState({ startupMessage, stageProgress: 0 });
  }

  private async startPreview() {
    const previewURL = await this.device.startPreview();
    this.stateManager.updateState({ previewURL });
  }

  private async isBuildStale(build: BuildResult) {
    const buildType = await inferBuildType(
      this.stateManager.getState().deviceInfo.platform,
      this.applicationContext.launchConfig
    );
    const currentBuildConfig = createBuildConfig(
      this.device,
      this.applicationContext.launchConfig,
      buildType
    );
    const currentFingerprint =
      await this.buildManager.calculateBuildFingerprint(currentBuildConfig);
    return currentFingerprint !== build.fingerprint;
  }

  private checkIsUsingStaleBuild = throttleAsync(async () => {
    const lastSuccessfulBuild = this.maybeBuildResult;
    if (!lastSuccessfulBuild || this.stateManager.getState().status !== "running") {
      // we only monitor for stale builds when the session is in 'running' state
      return;
    }
    if (await this.isBuildStale(lastSuccessfulBuild)) {
      this.stateManager.updateState({ isUsingStaleBuild: true });
    }
  }, CACHE_STALE_THROTTLE_MS);

  //#region Metro delegate methods

  private onBundleProgress = throttle((stageProgress: number) => {
    const store = this.stateManager.getState();
    if (store.status !== "starting") {
      return;
    }
    if (store.startupMessage === StartupMessage.WaitingForAppToLoad) {
      this.stateManager.updateState({ stageProgress });
    }
  }, 100);

  //#endregion

  /**
  This method is async to allow for awaiting it during restarts, please keep in mind tho that
  build in vscode dispose system ignores async keyword and works synchronously.
  */
  public async dispose() {
    this.cancelToken?.cancel();
    await this.deactivate();

    await this.applicationSession?.dispose();
    this.applicationSession = undefined;

    this.devtoolsServer?.dispose();

    this.device?.dispose();
    this.metro?.dispose();

    this.buildProgressListener.cancel();
    this.onBundleProgress.cancel();
    this.checkIsUsingStaleBuild.cancel();

    disposeAll(this.disposables);
  }

  public async activate() {
    if (!this.isActive) {
      this.isActive = true;
      try {
        await this.applicationSession?.activate();
      } catch (e) {
        // the session couldn't be activated, which means we probably have to restart the application altogether
        await this.autoReload();
      }
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
        platform: this.stateManager.getState().deviceInfo.platform,
        method: type,
      });
      await this.performReloadActionInternal(type);
      this.stateManager.updateState({
        status: "running",
      });
    } catch (e) {
      this.setFatalError(e as Error);
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

  private async getOrStartMetro({
    resetCache,
    forceRestart = false,
  }: {
    resetCache: boolean;
    forceRestart?: boolean;
  }) {
    // NOTE: `resetCache` requires restarting the server as well
    forceRestart = forceRestart || resetCache;

    try {
      if (!forceRestart && this.metro !== undefined && !this.metro.disposed) {
        return this.metro;
      }
    } catch {
      // ignore errors when accessing a disposed metro instance, just get a new one
    }

    this.metro?.dispose();
    this.metro = undefined;
    this.metro = forceRestart
      ? await this.metroProvider.restartServer({ resetCache })
      : await this.metroProvider.getMetroSession({ resetCache });
    this.metro.onBundleProgress(({ bundleProgress }) => this.onBundleProgress(bundleProgress));

    return this.metro;
  }

  private async restartMetro({ resetCache }: { resetCache: boolean }) {
    this.cancelOngoingOperations();
    const cancelToken = this.cancelToken;

    this.updateStartupMessage(StartupMessage.StartingPackager);
    await this.getOrStartMetro({ resetCache, forceRestart: true });

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
    this.cancelOngoingOperations();
    const cancelToken = this.cancelToken;
    if (this.applicationSession === undefined) {
      throw new Error(
        "JS bundle cannot be reloaded before an application is launched and connected to Radon"
      );
    }
    this.updateStartupMessage(StartupMessage.WaitingForAppToLoad);
    await this.applicationSession.reloadJS(cancelToken);
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
    await cancelToken.adapt(this.startPreview());

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
      platform: this.stateManager.getState().deviceInfo.platform,
    });

    const { isUsingStaleBuild } = this.stateManager.getState();

    if (this.maybeBuildResult && isUsingStaleBuild) {
      await this.restartDevice({ forceClean: false });
      return;
    }

    this.checkIsUsingStaleBuild();
    this.checkIsUsingStaleBuild.flush();

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
      this.stateManager.updateState({
        status: "running",
      });
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
      platform: this.stateManager.getState().deviceInfo.platform,
    });

    const metro = await this.getOrStartMetro({ resetCache: false });

    const applicationSessionPromise = ApplicationSession.launch(
      this.stateManager.getDerived("applicationSession"),
      this.navigationStateManager,
      {
        applicationContext: this.applicationContext,
        device: this.device,
        buildResult: this.buildResult,
        metro,
        devtoolsServer: this.devtoolsServer,
        devtoolsPort: this.devtoolsServer?.port,
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

      // NOTE: on iOS, we need to change keyboard langugage to match the device locale after the app is ready
      this.device.setUpKeyboard();

      this.stateManager.updateState({
        status: "running",
      });

      const launchDurationSec = (Date.now() - launchRequestTime) / 1000;
      Logger.info("App launched in", launchDurationSec.toFixed(2), "sec.");
      getTelemetryReporter().sendTelemetryEvent(
        "app:launch:completed",
        { platform: this.stateManager.getState().deviceInfo.platform },
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
          platform: this.stateManager.getState().deviceInfo.platform,
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

  private buildProgressListener = throttle((stageProgress: number) => {
    const store = this.stateManager.getState();
    if (store.status !== "starting") {
      return;
    }
    if (store.startupMessage === StartupMessage.Building) {
      this.stateManager.updateState({ stageProgress });
    }
  }, 100);

  private async buildApp({ clean, cancelToken }: { clean: boolean; cancelToken: CancelToken }) {
    const buildStartTime = Date.now();
    this.updateStartupMessage(StartupMessage.Building);
    this.maybeBuildResult = undefined;
    const launchConfiguration = this.applicationContext.launchConfig;

    const platform = this.stateManager.getState().deviceInfo.platform;

    const buildType = await inferBuildType(platform, launchConfiguration);

    // Native build dependencies when changed, should invalidate cached build (even if the fingerprint is the same)
    const buildDependenciesChanged = await this.checkBuildDependenciesChanged(platform);

    const buildConfig = createBuildConfig(this.device, launchConfiguration, buildType);

    const buildOptions = {
      forceCleanBuild: clean || buildDependenciesChanged,
      buildOutputChannel: this.outputChannelRegistry.getOrCreateOutputChannel(
        platform === DevicePlatform.IOS ? Output.BuildIos : Output.BuildAndroid
      ),
      cancelToken,
      progressListener: this.buildProgressListener,
    };

    const dependencyManager = this.applicationContext.applicationDependencyManager;
    await dependencyManager.ensureDependenciesForBuild(buildConfig, buildOptions);

    this.stateManager.updateState({ isUsingStaleBuild: false });
    this.maybeBuildResult = await this.buildManager.buildApp(buildConfig, buildOptions);
    const buildDurationSec = (Date.now() - buildStartTime) / 1000;
    Logger.info("Build completed in", buildDurationSec.toFixed(2), "sec.");
    getTelemetryReporter().sendTelemetryEvent(
      "build:completed",
      {
        platform,
      },
      { durationSec: buildDurationSec }
    );
  }

  private async installApp({ reinstall }: { reinstall: boolean }) {
    this.updateStartupMessage(StartupMessage.Installing);
    return this.device.installApp(this.buildResult, reinstall);
  }

  private setFatalError(e: Error) {
    if (e instanceof CancelError) {
      Logger.info("Device selection was canceled", e);
    } else if (e instanceof DeviceBootError) {
      this.stateManager.updateState({
        status: "fatalError",
        error: {
          kind: "device",
          message: e.message,
        },
      });
      return;
    } else if (e instanceof MetroError) {
      this.stateManager.updateState({
        status: "fatalError",
        error: {
          kind: "metro",
          message: e.message,
        },
      });
      return;
    } else if (e instanceof BuildError) {
      this.stateManager.updateState({
        status: "fatalError",
        error: {
          kind: "build",
          message: e.message,
          buildType: e.buildType,
          platform: this.stateManager.getState().deviceInfo.platform,
        },
      });
      return;
    } else if (e instanceof InstallationError) {
      this.stateManager.updateState({
        status: "fatalError",
        error: {
          kind: "installation",
          message: e.message,
          platform: this.stateManager.getState().deviceInfo.platform,
          reason: e.reason,
        },
      });
      return;
    } else {
      this.stateManager.updateState({
        status: "fatalError",
        error: {
          kind: "build",
          message: (e as Error).message,
          buildType: null,
          platform: this.stateManager.getState().deviceInfo.platform,
        },
      });
      return;
    }
    throw e;
  }

  public async start() {
    try {
      this.resetStartingState(StartupMessage.InitializingDevice);

      this.cancelOngoingOperations();
      const cancelToken = this.cancelToken;

      this.updateStartupMessage(StartupMessage.StartingPackager);

      const packageManagerOutputChannel = this.outputChannelRegistry.getOrCreateOutputChannel(
        Output.PackageManager
      );

      await this.applicationContext.applicationDependencyManager.ensureDependenciesForStart(
        packageManagerOutputChannel,
        this.cancelToken
      );

      await cancelToken.adapt(this.getOrStartMetro({ resetCache: false }));

      await cancelToken.adapt(this.bootDevice());
      await this.buildApp({
        clean: false,
        cancelToken,
      });
      await cancelToken.adapt(this.installApp({ reinstall: false }));
      await this.startPreview();
      await this.launchApp(cancelToken);
      Logger.debug("Device session started");
    } catch (e) {
      this.setFatalError(e as Error);
    }
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
    this.applicationSession?.openNavigation(id);
  }

  public navigateHome() {
    this.applicationSession?.navigateHome();
  }

  public navigateBack() {
    this.applicationSession?.navigateBack();
  }

  public removeNavigationHistoryEntry(id: string) {
    this.navigationStateManager.updateState({
      navigationHistory: this.navigationStateManager
        .getState()
        .navigationHistory.filter((record) => record.id !== id),
    });
  }

  public async openDevMenu() {
    await this.metro?.openDevMenu();
  }

  public async openPreview(previewId: string) {
    const { resolve, reject, promise } = Promise.withResolvers<void>();
    const listener = this.inspectorBridge?.onEvent("openPreviewResult", (payload) => {
      if (payload.previewId === previewId) {
        listener?.dispose();
        if (payload.error) {
          reject(payload.error);
        } else {
          resolve();
        }
      }
    });
    this.inspectorBridge?.sendOpenPreviewRequest(previewId);
    return promise;
  }

  public async sendBiometricAuthorization(isMatch: boolean) {
    await this.device.sendBiometricAuthorization(isMatch);
  }

  public openStorybookStory(componentTitle: string, storyName: string) {
    this.inspectorBridge?.sendShowStorybookStoryRequest(componentTitle, storyName);
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
    return this.metro?.port;
  }
}
