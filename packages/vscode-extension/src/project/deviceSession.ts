import _ from "lodash";
import assert from "assert";
import { commands, DebugSessionCustomEvent, Disposable, window } from "vscode";
import { MetroLauncher, MetroDelegate } from "./metro";
import { Devtools } from "./devtools";
import { DeviceBase } from "../devices/DeviceBase";
import { Logger } from "../Logger";
import {
  BuildError,
  BuildManager,
  BuildManagerDelegate,
  BuildResult,
  DisposableBuild,
} from "../builders/BuildManager";
import {
  AppPermissionType,
  DeviceSettings,
  StartupMessage,
  TouchPoint,
  DeviceButtonType,
  DeviceSessionState,
  BuildErrorDescriptor,
  ToolsState,
  ProfilingState,
  NavigationHistoryItem,
} from "../common/Project";
import { getLaunchConfiguration } from "../utilities/launchConfiguration";
import { DebugSession, DebugSessionDelegate, DebugSource } from "../debugging/DebugSession";
import { throttle } from "../utilities/throttle";
import { getTelemetryReporter } from "../utilities/telemetry";
import { CancelError, CancelToken } from "../builders/cancelToken";
import { DeviceInfo, DevicePlatform } from "../common/DeviceManager";
import { ToolKey, ToolsDelegate, ToolsManager } from "./tools";
import { extensionContext } from "../utilities/extensionContext";
import { ReloadAction } from "../common/DeviceSessionsManager";
import { focusSource } from "../utilities/focusSource";
import { ApplicationContext } from "./ApplicationContext";

const DEVICE_SETTINGS_KEY = "device_settings_v4";
const MAX_URL_HISTORY_SIZE = 20;

const something = 88;

export const DEVICE_SETTINGS_DEFAULT: DeviceSettings = {
  appearance: "dark",
  contentSize: "normal",
  location: {
    latitude: 50.048653,
    longitude: 19.965474,
    isDisabled: false,
  },
  hasEnrolledBiometrics: false,
  locale: "en_US",
  replaysEnabled: false,
  showTouches: false,
};

type StartOptions = {
  cleanBuild: boolean;
  resetMetroCache: boolean;
};

type RestartOptions = {
  forceClean: boolean;
  cleanCache: boolean;
};

export type DeviceSessionDelegate = {
  onStateChange(state: DeviceSessionState): void;
  ensureDependenciesAndNodeVersion(): Promise<void>;
};

export class DeviceBootError extends Error {
  constructor(
    message: string,
    public readonly cause: unknown
  ) {
    super(message);
  }
}

export class DeviceSession
  implements Disposable, MetroDelegate, ToolsDelegate, DebugSessionDelegate, BuildManagerDelegate
{
  private isActive = false;
  private metro: MetroLauncher;
  private toolsManager: ToolsManager;
  private inspectCallID = 7621;
  private maybeBuildResult: BuildResult | undefined;
  public devtools; // TODO: make this private!
  private debugSession: DebugSession;
  private disposableBuild: DisposableBuild<BuildResult> | undefined;
  private buildManager: BuildManager;
  public deviceSettings: DeviceSettings;
  private isLaunching = true;
  private cancelToken: CancelToken | undefined;

  private status: DeviceSessionState["status"] = "starting";
  private startupMessage: StartupMessage | undefined;
  private stageProgress: number | undefined;
  private buildError: BuildErrorDescriptor | undefined;
  private fastRefreshOngoing = false;
  private profilingCPUState: ProfilingState = "stopped";
  private profilingReactState: ProfilingState = "stopped";
  private navigationHistory: NavigationHistoryItem[] = [];
  private navigationBackTarget: NavigationHistoryItem | undefined;
  private logCounter = 0;
  private isDebuggerPaused = false;
  private hasStaleBuildCache = false;
  private get buildResult() {
    if (!this.maybeBuildResult) {
      throw new Error("Expecting build to be ready");
    }
    return this.maybeBuildResult;
  }

  public get isAppLaunched() {
    return !this.isLaunching;
  }

  public get previewURL() {
    return this.device.previewURL;
  }

  public get platform(): DevicePlatform {
    return this.device.platform;
  }

  constructor(
    private readonly applicationContext: ApplicationContext,
    readonly deviceInfo: DeviceInfo,
    private readonly device: DeviceBase,
    private readonly deviceSessionDelegate: DeviceSessionDelegate
  ) {
    this.deviceSettings =
      extensionContext.workspaceState.get(DEVICE_SETTINGS_KEY) ?? DEVICE_SETTINGS_DEFAULT;

    this.devtools = this.makeDevtools();
    this.metro = new MetroLauncher(this.devtools, this);
    this.toolsManager = new ToolsManager(this.devtools, this);

    this.buildManager = new BuildManager(
      applicationContext.dependencyManager,
      applicationContext.buildCache,
      this,
      device.platform
    );
    this.debugSession = new DebugSession(this);
  }

  public getState(): DeviceSessionState {
    return {
      status: this.status,
      startupMessage: this.startupMessage,
      stageProgress: this.stageProgress,
      buildError: this.buildError,
      fastRefreshOngoing: this.fastRefreshOngoing,
      profilingCPUState: this.profilingCPUState,
      profilingReactState: this.profilingReactState,
      navigationHistory: this.navigationHistory,
      selectedDevice: this.deviceInfo,
      previewURL: this.previewURL,
      toolsState: this.toolsManager.getToolsState(),
      isDebuggerPaused: this.isDebuggerPaused,
      logCounter: this.logCounter,
      hasStaleBuildCache: this.hasStaleBuildCache,
    };
  }

  //#region Metro delegate methods

  onBundleProgress = throttle((stageProgress: number) => {
    if (this.startupMessage === StartupMessage.WaitingForAppToLoad) {
      this.stageProgress = stageProgress;
      this.emitStateChange();
    }
  }, 100);

  onBundlingError = async (message: string, source: DebugSource, errorModulePath: string) => {
    await this.appendDebugConsoleEntry(message, "error", source);

    if (this.status === "starting") {
      focusSource(source);
    }

    Logger.error("[Bundling Error]", message);

    this.status = "bundlingError";
    this.emitStateChange();
  };

  //#endregion

  //#region Tools delegate methods

  onToolsStateChange = (toolsState: ToolsState) => {
    this.emitStateChange();
  };

  //#endregion

  //#region Debug session delegate methods

  onConsoleLog = (event: DebugSessionCustomEvent): void => {
    this.logCounter += 1;
    this.emitStateChange();
  };

  onDebuggerPaused = (event: DebugSessionCustomEvent): void => {
    this.isDebuggerPaused = true;
    this.emitStateChange();

    if (this.isActive) {
      commands.executeCommand("workbench.view.debug");
    }
  };

  onDebuggerResumed = (event: DebugSessionCustomEvent): void => {
    this.isDebuggerPaused = false;
    this.emitStateChange();
  };

  onProfilingCPUStarted = (event: DebugSessionCustomEvent): void => {
    this.profilingCPUState = "profiling";
    this.emitStateChange();
  };

  onProfilingCPUStopped = (event: DebugSessionCustomEvent): void => {
    this.profilingCPUState = "stopped";
    this.emitStateChange();
  };

  //#endregion

  //#region Build manager delegate methods

  onCacheStale = (platform: DevicePlatform) => {
    if (platform === this.device.platform) {
      this.hasStaleBuildCache = true;
      this.emitStateChange();
    }
  };

  //#endregion

  private makeDevtools() {
    const devtools = new Devtools();
    devtools.onEvent("RNIDE_appReady", () => {
      Logger.debug("App ready");
    });
    // We don't need to store event disposables here as they are tied to the lifecycle
    // of the devtools instance, which is disposed when we recreate the devtools or
    // when the device session is disposed
    devtools.onEvent("RNIDE_navigationChanged", (payload: NavigationHistoryItem) => {
      const backTargetId = this.navigationBackTarget?.id;
      if (backTargetId === payload.id) {
        // we are navigating back, remove all items from history that are before the back target
        const backTargetIndex = this.navigationHistory.findIndex(
          (record) => record.id === backTargetId
        );
        if (backTargetIndex !== -1) {
          this.navigationHistory = this.navigationHistory.slice(backTargetIndex + 1);
        }
      }

      this.navigationBackTarget = undefined;
      this.navigationHistory = [
        payload,
        ...this.navigationHistory.filter((record) => record.id !== payload.id),
      ].slice(0, MAX_URL_HISTORY_SIZE);
      this.emitStateChange();
    });
    devtools.onEvent("RNIDE_fastRefreshStarted", () => {
      this.fastRefreshOngoing = true;
      this.emitStateChange();
    });
    devtools.onEvent("RNIDE_fastRefreshComplete", () => {
      this.fastRefreshOngoing = false;
      this.emitStateChange();
    });
    devtools.onEvent("RNIDE_isProfilingReact", (isProfiling) => {
      if (this.profilingReactState !== "saving") {
        this.profilingReactState = isProfiling ? "profiling" : "stopped";
        this.emitStateChange();
      }
    });
    return devtools;
  }

  /**
  This method is async to allow for awaiting it during restarts, please keep in mind tho that
  build in vscode dispose system ignores async keyword and works synchronously.
  */
  public async dispose() {
    this.deactivate();
    await this.debugSession?.dispose();
    this.disposableBuild?.dispose();
    this.device?.dispose();
    this.metro?.dispose();
    this.devtools?.dispose();
  }

  public async activate() {
    this.isActive = true;
    this.buildManager.activate();
    this.toolsManager.activate();
    this.debugSession = new DebugSession(this);
    await this.debugSession.startParentDebugSession();
    await this.connectJSDebugger();
  }

  public async deactivate() {
    this.isActive = false;
    await this.debugSession.dispose();
    this.buildManager.deactivate();
    this.toolsManager.deactivate();
  }

  public async performReloadAction(type: ReloadAction): Promise<boolean> {
    try {
      this.status = "starting";
      this.emitStateChange();

      getTelemetryReporter().sendTelemetryEvent("url-bar:reload-requested", {
        platform: this.device.platform,
        method: type,
      });
      const result = await this.performReloadActionInternal(type);
      if (result) {
        this.status = "running";
        this.emitStateChange();
      } else {
        window.showErrorMessage("Failed to reload, you may try another reload option.", "Dismiss");
      }
      return result;
    } catch (e) {
      if (e instanceof CancelError) {
        // reload got cancelled, we don't show any errors
        return false;
      } else if (e instanceof BuildError) {
        this.status = "buildError";
        this.buildError = {
          message: e.message,
          buildType: e.buildType,
          platform: this.device.platform,
        };
        this.emitStateChange();
      }
      Logger.error("Failed to perform reload action", type, e);
      throw e;
    }
  }

  private async performReloadActionInternal(type: ReloadAction): Promise<boolean> {
    try {
      switch (type) {
        case "autoReload":
          await this.autoReload();
          return true;
        case "reboot":
          await this.restart({ forceClean: false, cleanCache: false });
          return true;
        case "clearMetro":
          await this.restart({ forceClean: false, cleanCache: true });
          return true;
        case "rebuild":
          await this.restart({ forceClean: true, cleanCache: false });
          return true;
        case "reinstall":
          await this.reinstallApp();
          return true;
        case "restartProcess":
          return await this.restartProcess();
        case "reloadJs":
          return await this.reloadJS();
      }
    } catch (e) {
      Logger.debug("[Reload]", e);
      throw e;
    }
  }

  private async reloadJS() {
    if (this.devtools.hasConnectedClient) {
      try {
        await this.reloadMetro();
        return true;
      } catch (e) {
        Logger.error("Failed to reload JS", e);
      }
    }
    return false;
  }

  private async reinstallApp() {
    if (this.cancelToken) {
      this.cancelToken.cancel();
      this.cancelToken = undefined;
    }
    const cancelToken = new CancelToken();
    this.cancelToken = cancelToken;

    await cancelToken.adapt(this.restartDebugger());
    await cancelToken.adapt(this.installApp({ reinstall: true }));
    await this.launchApp(cancelToken);
  }

  private async restartProcess() {
    if (this.cancelToken) {
      this.cancelToken.cancel();
      this.cancelToken = undefined;
    }
    const cancelToken = new CancelToken();
    this.cancelToken = cancelToken;

    await cancelToken.adapt(this.restartDebugger());
    const launchSucceeded = await this.launchApp(cancelToken);
    if (!launchSucceeded) {
      return false;
    }
    return true;
  }

  private async restart({ forceClean, cleanCache }: RestartOptions) {
    if (this.cancelToken) {
      this.cancelToken.cancel();
      this.cancelToken = undefined;
    }

    const cancelToken = new CancelToken();
    this.cancelToken = cancelToken;

    if (cleanCache) {
      const oldDevtools = this.devtools;
      const oldMetro = this.metro;
      const oldToolsManager = this.toolsManager;
      this.devtools = this.makeDevtools();
      this.metro = new MetroLauncher(this.devtools, this);
      this.toolsManager = new ToolsManager(this.devtools, this);
      oldToolsManager.dispose();
      oldDevtools.dispose();
      oldMetro.dispose();

      Logger.debug(`Launching devtools`);
      this.devtools.start();

      Logger.debug(`Launching metro`);
      this.metro.start({
        resetCache: true,
        appRoot: this.applicationContext.appRootFolder,
        dependencies: [],
      });
    }

    await cancelToken.adapt(this.restartDebugger());
    this.startupMessage = StartupMessage.BootingDevice;
    this.emitStateChange();
    await cancelToken.adapt(this.device.reboot());
    await this.buildApp({
      appRoot: this.applicationContext.appRootFolder,
      clean: forceClean,
      cancelToken,
    });
    await this.installApp({ reinstall: false });
    await this.launchApp(cancelToken);
    Logger.debug("Device session started");
  }

  private async autoReload() {
    getTelemetryReporter().sendTelemetryEvent("url-bar:restart-requested", {
      platform: this.device.platform,
    });

    this.status = "starting";
    this.emitStateChange();

    try {
      if (this.buildManager.shouldRebuild()) {
        await this.restart({ forceClean: false, cleanCache: false });
        return;
      }

      // if reloading JS is possible, we try to do it first and exit in case of success
      // otherwise we continue to restart using more invasive methods
      if (await this.reloadJS()) {
        return;
      }

      const restartSucceeded = await this.restartProcess();
      if (restartSucceeded) {
        this.status = "running";
        this.emitStateChange();
      }
    } catch (e) {
      if (e instanceof CancelError) {
        // when restart process is cancelled, we don't want to fallback into
        // restarting the session again
        return;
      }
      // finally in case of any errors, the last resort is performing project
      // restart and device selection (we still avoid forcing clean builds, and
      // only do clean build when explicitly requested).
      // before doing anything, we check if the device hasn't been updated in the meantime
      // which might have initiated a new session anyway
      await this.restart({ forceClean: false, cleanCache: false });
    }
  }

  private async restartDebugger() {
    await this.debugSession.restart();
  }

  private launchAppCancelToken: CancelToken | undefined;

  private async reconnectJSDebuggerIfNeeded() {
    // after reloading JS, we sometimes need to reconnect the JS debugger. This is
    // needed specifically in Expo Go based environments where the reloaded runtime
    // will be listed as a new target.
    // Additionally, in some cases the old websocket endpoint would still be listed
    // despite the runtime being terminated.
    // In order to properly handle this case we first check if the websocket endpoint
    // is still listed and if it is, we verify that the runtime is responding by
    // requesting to execute some simple JS snippet.
    const currentWsTarget = this.debugSession?.websocketTarget;
    if (currentWsTarget) {
      const possibleWsTargets = await this.metro.fetchWsTargets();
      const currentWsTargetStillVisible = possibleWsTargets?.some(
        (runtime) => runtime.webSocketDebuggerUrl === currentWsTarget
      );
      if (currentWsTargetStillVisible) {
        // verify the runtime is responding
        const isRuntimeResponding = await this.debugSession.pingJsDebugSessionWithTimeout();
        if (isRuntimeResponding) {
          return;
        }
      }
    }
    await this.connectJSDebugger();
  }

  private async reloadMetro() {
    this.startupMessage = StartupMessage.WaitingForAppToLoad;
    this.emitStateChange();
    const { promise: bundleErrorPromise, reject } = Promise.withResolvers();
    const bundleErrorSubscription = this.metro.onBundleError(() => {
      reject(new Error("Bundle error occurred during reload"));
    });
    try {
      await this.metro.reload();
      await Promise.race([this.devtools.appReady(), bundleErrorPromise]);
    } finally {
      bundleErrorSubscription.dispose();
    }
    this.startupMessage = StartupMessage.AttachingDebugger;
    this.emitStateChange();
    await this.reconnectJSDebuggerIfNeeded();
  }

  private async launchApp(cancelToken: CancelToken) {
    cancelToken.cancel();

    const launchRequestTime = Date.now();
    getTelemetryReporter().sendTelemetryEvent("app:launch:requested", {
      platform: this.device.platform,
    });
    this.isLaunching = true;
    this.device.disableReplays();

    // FIXME: Windows getting stuck waiting for the promise to resolve. This
    // seems like a problem with app connecting to Metro and using embedded
    // bundle instead.
    const shouldWaitForAppLaunch = getLaunchConfiguration().preview?.waitForAppLaunch !== false;
    const waitForAppReady = shouldWaitForAppLaunch ? this.devtools.appReady() : Promise.resolve();

    this.startupMessage = StartupMessage.Launching;
    this.emitStateChange();
    await cancelToken.adapt(
      this.device.launchApp(this.buildResult, this.metro.port, this.devtools.port)
    );

    Logger.debug("Will wait for app ready and for preview");
    this.startupMessage = StartupMessage.WaitingForAppToLoad;
    this.emitStateChange();

    let previewURL: string | undefined;
    if (shouldWaitForAppLaunch) {
      const reportWaitingStuck = setTimeout(() => {
        Logger.info(
          "App is taking very long to boot up, it might be stuck. Device preview URL:",
          previewURL
        );
        getTelemetryReporter().sendTelemetryEvent("app:launch:waiting-stuck", {
          platform: this.device.platform,
        });
      }, 30000);
      waitForAppReady.then(() => clearTimeout(reportWaitingStuck));
    }

    await cancelToken.adapt(
      Promise.all([
        this.metro.ready(),
        this.device.startPreview().then((url) => {
          previewURL = url;
          this.emitStateChange();
        }),
        waitForAppReady,
      ])
    );

    Logger.debug("App and preview ready, moving on...");
    this.startupMessage = StartupMessage.AttachingDebugger;
    this.emitStateChange();
    await cancelToken.adapt(this.connectJSDebugger());

    this.isLaunching = false;
    if (this.deviceSettings?.replaysEnabled) {
      this.device.enableReplay();
    }
    if (this.deviceSettings?.showTouches) {
      this.device.showTouches();
    }

    const launchDurationSec = (Date.now() - launchRequestTime) / 1000;
    Logger.info("App launched in", launchDurationSec.toFixed(2), "sec.");
    getTelemetryReporter().sendTelemetryEvent(
      "app:launch:completed",
      { platform: this.device.platform },
      { durationSec: launchDurationSec }
    );

    return previewURL!;
  }

  private async bootDevice(deviceSettings: DeviceSettings) {
    this.startupMessage = StartupMessage.BootingDevice;
    this.emitStateChange();
    try {
      await this.device.bootDevice(deviceSettings);
    } catch (e) {
      Logger.error("Failed to boot device", e);
      throw new DeviceBootError("Failed to boot device", e);
    }
  }

  private async buildApp({
    appRoot,
    clean,
    cancelToken,
  }: {
    appRoot: string;
    clean: boolean;
    cancelToken: CancelToken;
  }) {
    const buildStartTime = Date.now();
    this.startupMessage = StartupMessage.Building;
    this.emitStateChange();
    this.disposableBuild = this.buildManager.startBuild(this.device.deviceInfo, {
      appRoot,
      clean,
      progressListener: throttle((stageProgress: number) => {
        if (this.startupMessage === StartupMessage.Building) {
          this.stageProgress = stageProgress;
          this.emitStateChange();
        }
      }, 100),
      cancelToken,
    });
    this.maybeBuildResult = await this.disposableBuild.build;
    const buildDurationSec = (Date.now() - buildStartTime) / 1000;
    Logger.info("Build completed in", buildDurationSec.toFixed(2), "sec.");
    getTelemetryReporter().sendTelemetryEvent(
      "build:completed",
      {
        platform: this.device.platform,
      },
      { durationSec: buildDurationSec }
    );
  }

  private async installApp({ reinstall }: { reinstall: boolean }) {
    this.startupMessage = StartupMessage.Installing;
    this.emitStateChange();
    return this.device.installApp(this.buildResult, reinstall);
  }

  private async waitForMetroReady() {
    this.startupMessage = StartupMessage.StartingPackager;
    this.emitStateChange();
    // wait for metro/devtools to start before we continue
    await Promise.all([this.metro.ready(), this.devtools.ready()]);
    Logger.debug("Metro & devtools ready");
  }

  public async start({ cleanBuild, resetMetroCache }: StartOptions) {
    try {
      await this.startInternal({ cleanBuild, resetMetroCache });
    } catch (e) {
      if (e instanceof CancelError) {
        Logger.info("Device selection was canceled", e);
      } else if (e instanceof DeviceBootError) {
        this.status = "bootError";
      } else if (e instanceof BuildError) {
        this.status = "buildError";
        this.buildError = {
          message: e.message,
          buildType: e.buildType,
          platform: this.device.platform,
        };
      } else {
        this.status = "buildError";
        this.buildError = {
          message: (e as Error).message,
          buildType: null,
          platform: this.device.platform,
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

  private async startInternal({ cleanBuild, resetMetroCache }: StartOptions) {
    this.status = "starting";
    this.stageProgress = undefined;
    this.startupMessage = StartupMessage.InitializingDevice;
    this.emitStateChange();

    if (this.cancelToken) {
      this.cancelToken.cancel();
      this.cancelToken = undefined;
    }

    const cancelToken = new CancelToken();
    this.cancelToken = cancelToken;

    const waitForNodeModules = this.deviceSessionDelegate.ensureDependenciesAndNodeVersion();

    Logger.debug(`Launching devtools`);
    this.devtools.start();

    Logger.debug(`Launching metro`);
    this.metro.start({
      resetCache: resetMetroCache,
      appRoot: this.applicationContext.appRootFolder,
      dependencies: [waitForNodeModules],
    });
    // We start the debug session early to be able to use it to surface bundle
    // errors in the console. We only start the parent debug session and the JS
    // debugger will be started at later time once the app is built and launched.
    await cancelToken.adapt(this.debugSession.startParentDebugSession());

    await cancelToken.adapt(this.waitForMetroReady());
    // TODO(jgonet): Build and boot simultaneously, with predictable state change updates
    await cancelToken.adapt(this.bootDevice(this.deviceSettings));
    await this.buildApp({
      appRoot: this.applicationContext.appRootFolder,
      clean: cleanBuild,
      cancelToken,
    });
    await cancelToken.adapt(this.installApp({ reinstall: false }));
    await this.launchApp(cancelToken);
    Logger.debug("Device session started");
  }

  private async connectJSDebugger() {
    const websocketAddress = await this.metro.getDebuggerURL();
    if (!websocketAddress) {
      Logger.error("Couldn't find a proper debugger URL to connect to");
      return;
    }
    const connected = await this.debugSession.startJSDebugSession({
      websocketAddress,
      displayDebuggerOverlay: false,
      isUsingNewDebugger: this.metro.isUsingNewDebugger,
      expoPreludeLineCount: this.metro.expoPreludeLineCount,
      sourceMapPathOverrides: this.metro.sourceMapPathOverrides,
    });

    if (connected) {
      // TODO(jgonet): Right now, we ignore start failure
      Logger.debug("Connected to debugger, moving on...");
    } else {
      Logger.error("Couldn't connect to debugger");
    }
  }

  public resumeDebugger() {
    this.debugSession?.resumeDebugger();
  }

  public stepOverDebugger() {
    this.debugSession?.stepOverDebugger();
  }

  public async appendDebugConsoleEntry(message: string, type: string, source: DebugSource) {
    await this.debugSession?.appendDebugConsoleEntry(message, type, source);
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

      if (terminateApp) {
        this.reconnectJSDebuggerIfNeeded();
      }
    }
  }

  public startRecording() {
    return this.device.startRecording();
  }

  public async captureAndStopRecording() {
    return this.device.captureAndStopRecording();
  }

  public async captureReplay() {
    return this.device.captureReplay();
  }

  public async captureScreenshot() {
    return this.device.captureScreenshot();
  }

  public async startProfilingReact() {
    return await this.devtools.startProfilingReact();
  }

  public async stopProfilingReact() {
    try {
      return await this.devtools.stopProfilingReact();
    } finally {
      this.profilingReactState = "stopped";
      this.emitStateChange();
    }
  }

  public async startProfilingCPU() {
    if (this.debugSession) {
      await this.debugSession.startProfilingCPU();
    } else {
      throw new Error("Debug session not started");
    }
  }

  public async stopProfilingCPU() {
    if (this.debugSession) {
      await this.debugSession.stopProfilingCPU();
    } else {
      throw new Error("Debug session not started");
    }
  }

  public sendTouches(touches: Array<TouchPoint>, type: "Up" | "Move" | "Down") {
    this.device.sendTouches(touches, type);
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
    requestStack: boolean,
    callback: (inspectData: any) => void
  ) {
    const id = this.inspectCallID++;
    const listener = this.devtools.onEvent("RNIDE_inspectData", (payload) => {
      if (payload.id === id) {
        listener.dispose();
        callback(payload);
      }
    });
    this.devtools.send("RNIDE_inspect", { x: xRatio, y: yRatio, id, requestStack });
  }

  public openNavigation(id: string) {
    this.devtools.send("RNIDE_openNavigation", { id });
  }

  public navigateBack() {
    if (this.navigationHistory.length > 1) {
      this.navigationBackTarget = this.navigationHistory[1];
      this.devtools.send("RNIDE_openNavigation", { id: this.navigationBackTarget.id });
    }
  }

  public async openDevMenu() {
    await this.metro.openDevMenu();
  }

  public async startPreview(previewId: string) {
    const { resolve, reject, promise } = Promise.withResolvers<void>();
    const listener = this.devtools.onEvent("RNIDE_openPreviewResult", (payload) => {
      if (payload.previewId === previewId) {
        listener.dispose();
        if (payload.error) {
          reject(payload.error);
        } else {
          resolve();
        }
      }
    });
    this.devtools.send("RNIDE_openPreview", { previewId });
    return promise;
  }

  public async changeDeviceSettings(settings: DeviceSettings): Promise<boolean> {
    const changedSettings = (Object.keys(settings) as Array<keyof DeviceSettings>).filter(
      (settingKey) => {
        return !_.isEqual(settings[settingKey], this.deviceSettings[settingKey]);
      }
    );

    getTelemetryReporter().sendTelemetryEvent("device-settings:update-device-settings", {
      platform: this.device.platform,
      changedSetting: JSON.stringify(changedSettings),
    });

    extensionContext.workspaceState.update(DEVICE_SETTINGS_KEY, settings);
    if (this.deviceSettings?.replaysEnabled !== settings.replaysEnabled && !this.isLaunching) {
      if (settings.replaysEnabled) {
        this.device.enableReplay();
      } else {
        this.device.disableReplays();
      }
    }
    if (this.deviceSettings?.showTouches !== settings.showTouches && !this.isLaunching) {
      if (settings.showTouches) {
        this.device.showTouches();
      } else {
        this.device.hideTouches();
      }
    }
    this.deviceSettings = settings;

    return this.device.changeSettings(settings);
  }

  public focusBuildOutput() {
    this.buildManager.focusBuildOutput();
  }

  public async sendBiometricAuthorization(isMatch: boolean) {
    await this.device.sendBiometricAuthorization(isMatch);
  }

  public async updateToolEnabledState(toolName: ToolKey, enabled: boolean) {
    this.toolsManager.updateToolEnabledState(toolName, enabled);
  }

  public async openTool(toolName: ToolKey) {
    this.toolsManager.openTool(toolName);
  }

  public getPlugin(toolName: ToolKey) {
    return this.toolsManager.getPlugin(toolName);
  }

  public getMetroPort() {
    return this.metro.port;
  }

  public resetLogCounter() {
    this.logCounter = 0;
    this.emitStateChange();
  }
}
