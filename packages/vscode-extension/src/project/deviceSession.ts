import path from "path";
import fs from "fs";
import assert from "assert";
import _ from "lodash";
import {
  commands,
  window,
  DebugSessionCustomEvent,
  Disposable,
  extensions,
  Uri,
  workspace,
} from "vscode";
import { MetroLauncher, MetroDelegate } from "./metro";
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
  ToolsState,
  ProfilingState,
  NavigationHistoryItem,
  NavigationRoute,
  DeviceSessionStatus,
  FatalErrorDescriptor,
  BundleErrorDescriptor,
  DeviceRotation,
  AppOrientation,
} from "../common/Project";
import { DebugSession, DebugSessionImpl, DebugSource } from "../debugging/DebugSession";
import { throttle, throttleAsync } from "../utilities/throttle";
import { getTelemetryReporter } from "../utilities/telemetry";
import { CancelError, CancelToken } from "../utilities/cancelToken";
import { DevicePlatform } from "../common/DeviceManager";
import { ToolKey, ToolsDelegate, ToolsManager } from "./tools";
import { ReloadAction } from "../common/DeviceSessionsManager";
import { focusSource } from "../utilities/focusSource";
import { ApplicationContext } from "./ApplicationContext";
import { BuildCache } from "../builders/BuildCache";
import { watchProjectFiles } from "../utilities/watchProjectFiles";
import { OutputChannelRegistry } from "./OutputChannelRegistry";
import { Output } from "../common/OutputChannel";
import { disposeAll } from "../utilities/disposables";
import { ReconnectingDebugSession } from "../debugging/ReconnectingDebugSession";

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

export class DeviceSession implements Disposable, MetroDelegate, ToolsDelegate {
  private isActive = false;
  private metro: MetroLauncher;
  private toolsManager: ToolsManager;
  private inspectCallID = 7621;
  private maybeBuildResult: BuildResult | undefined;
  private devtools: Devtools;
  private debugSession: DebugSession & Disposable;
  private debugSessionEventSubscription: Disposable;
  private buildManager: BuildManager;
  private buildCache: BuildCache;
  private cancelToken: CancelToken | undefined;
  private watchProjectSubscription: Disposable;

  private status: DeviceSessionStatus = "starting";
  private startupMessage: StartupMessage = StartupMessage.InitializingDevice;
  private stageProgress: number | undefined;
  private fatalError: FatalErrorDescriptor | undefined;
  private bundleError: BundleErrorDescriptor | undefined;
  private isRefreshing: boolean = false;
  private profilingCPUState: ProfilingState = "stopped";
  private profilingReactState: ProfilingState = "stopped";
  private navigationHistory: NavigationHistoryItem[] = [];
  private navigationRouteList: NavigationRoute[] = [];
  private navigationHomeTarget: NavigationHistoryItem | undefined;
  private logCounter = 0;
  private isDebuggerPaused = false;
  private hasStaleBuildCache = false;
  private isRecordingScreen = false;
  private appOrientation: DeviceRotation | undefined;

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
    private rotation: DeviceRotation,
    private readonly deviceSessionDelegate: DeviceSessionDelegate,
    private readonly outputChannelRegistry: OutputChannelRegistry
  ) {
    this.devtools = this.makeDevtools();
    this.metro = new MetroLauncher(this.devtools, this);
    this.toolsManager = new ToolsManager(this.inspectorBridge, this);

    this.buildCache = this.applicationContext.buildCache;
    this.buildManager = this.applicationContext.buildManager;

    this.debugSession = this.createDebugSession();
    this.debugSessionEventSubscription = this.registerDebugSessionListeners();
    this.watchProjectSubscription = watchProjectFiles(this.onProjectFilesChanged);
  }

  public getState(): DeviceSessionState {
    const commonState = {
      profilingCPUState: this.profilingCPUState,
      profilingReactState: this.profilingReactState,
      navigationHistory: this.navigationHistory,
      navigationRouteList: this.navigationRouteList,
      deviceInfo: this.device.deviceInfo,
      previewURL: this.previewURL,
      toolsState: this.toolsManager.getToolsState(),
      isDebuggerPaused: this.isDebuggerPaused,
      logCounter: this.logCounter,
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
      return {
        ...commonState,
        status: "running",
        isRefreshing: this.isRefreshing,
        bundleError: this.bundleError,
        appOrientation: this.appOrientation,
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
    this.bundleError = undefined;
    this.isRefreshing = false;
    this.hasStaleBuildCache = false;
    this.profilingCPUState = "stopped";
    this.profilingReactState = "stopped";
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

  onBundlingError = async (message: string, source: DebugSource, errorModulePath: string) => {
    await this.appendDebugConsoleEntry(message, "error", source);

    if (this.status === "starting") {
      focusSource(source);
    }

    Logger.error("[Bundling Error]", message);

    this.status = "running";
    this.bundleError = {
      kind: "bundle",
      message,
    };
    this.emitStateChange();
  };

  //#endregion

  //#region Tools delegate methods

  onToolsStateChange = (toolsState: ToolsState) => {
    this.emitStateChange();
  };

  //#endregion

  //#region Debug session event listeners

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
    if (event.body?.filePath) {
      this.saveAndOpenCPUProfile(event.body.filePath);
    }
  };

  private registerDebugSessionListeners(): Disposable {
    const subscriptions: Disposable[] = [
      this.debugSession.onConsoleLog(this.onConsoleLog),
      this.debugSession.onDebuggerPaused(this.onDebuggerPaused),
      this.debugSession.onDebuggerResumed(this.onDebuggerResumed),
      this.debugSession.onProfilingCPUStarted(this.onProfilingCPUStarted),
      this.debugSession.onProfilingCPUStopped(this.onProfilingCPUStopped),
    ];
    return new Disposable(() => {
      disposeAll(subscriptions);
    });
  }

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

  private createDebugSession(): DebugSession & Disposable {
    return new ReconnectingDebugSession(
      new DebugSessionImpl({
        displayName: this.device.deviceInfo.displayName,
        useParentDebugSession: true,
      }),
      this.metro,
      this.devtools
    );
  }

  private makeDevtools() {
    const devtools = new Devtools();
    devtools.onEvent("appReady", () => {
      this.device.setUpKeyboard();
      // NOTE: since this is triggered by the JS bundle,
      // we can assume that if it fires, the bundle loaded successfully.
      // This is necessary to reset the bundle error state when the app reload
      // is triggered from the app itself (e.g. by in-app dev menu or redbox).
      this.bundleError = undefined;
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
    devtools.onEvent("fastRefreshStarted", () => {
      this.isRefreshing = true;
      this.bundleError = undefined;
      this.emitStateChange();
    });
    devtools.onEvent("fastRefreshComplete", () => {
      this.isRefreshing = false;
      this.emitStateChange();
    });
    devtools.onEvent("isProfilingReact", (isProfiling) => {
      if (this.profilingReactState !== "saving") {
        this.profilingReactState = isProfiling ? "profiling" : "stopped";
        this.emitStateChange();
      }
    });
    devtools.onEvent("appOrientationChanged", (orientation: AppOrientation) => {
      const isLandscape =
        this.rotation === DeviceRotation.LandscapeLeft ||
        this.rotation === DeviceRotation.LandscapeRight;

      if (orientation === "Landscape") {
        // if the app orientation is equal to "Landscape", it means we do not have enough
        // information on the application side to infer the detailed orientation.
        if (isLandscape) {
          // if the device is in landscape mode, we assume that the app orientation is correct with device rotation
          this.appOrientation = this.rotation;
        } else {
          // if the device is not in landscape mode we set app orientation to the last known orientation.
          // if the last orientation is not known, we assume the application was started in Landscape mode
          // while the device was oriented in Portrait, and we pick `LandscapeLeft` as the default orientation in that case.
          this.appOrientation = this.appOrientation ?? DeviceRotation.LandscapeLeft;
        }
      } else {
        this.appOrientation = orientation;
      }

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
    this.debugSessionEventSubscription.dispose();
    await this.debugSession.dispose();
    this.device?.dispose();
    this.metro?.dispose();
    this.devtools?.dispose();
    this.watchProjectSubscription.dispose();
  }

  public async activate() {
    if (!this.isActive) {
      this.isActive = true;
      this.toolsManager.activate();
      if (this.startupMessage === StartupMessage.AttachingDebugger) {
        this.debugSession = this.createDebugSession();
        this.debugSessionEventSubscription = this.registerDebugSessionListeners();
        await this.connectJSDebugger();
      }
    }
  }

  public async deactivate() {
    if (this.isActive) {
      this.isActive = false;
      this.toolsManager.deactivate();
      // detaching debugger will also stop the debug console, after switching back
      // to the device session, we won't be able to see the logs from the previous session
      // hence we reset the log counter.
      this.logCounter = 0;
      this.emitStateChange();
      this.debugSessionEventSubscription.dispose();
      await this.debugSession.dispose();
    }
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
    if (this.cancelToken) {
      this.cancelToken.cancel();
    }

    const cancelToken = new CancelToken();
    this.cancelToken = cancelToken;

    this.status = "starting";
    this.fatalError = undefined;
    this.updateStartupMessage(StartupMessage.StartingPackager);

    const oldMetro = this.metro;
    const oldToolsManager = this.toolsManager;
    this.metro = new MetroLauncher(this.devtools, this);
    this.toolsManager = new ToolsManager(this.inspectorBridge, this);
    oldMetro.dispose();
    oldToolsManager.dispose();

    Logger.debug(`Launching metro`);
    await this.metro.start({
      resetCache,
      launchConfiguration: this.applicationContext.launchConfig,
      dependencies: [],
    });

    await cancelToken.adapt(this.restartDebugger());
    if (!this.maybeBuildResult) {
      await this.buildApp({ clean: false, cancelToken });
    }
    await cancelToken.adapt(this.installApp({ reinstall: false }));
    await this.launchApp(cancelToken);
    Logger.debug("Metro restarted");
  }

  private async reloadJS() {
    if (!this.devtools.hasConnectedClient) {
      throw new Error(
        "JS bundle cannot be reloaded before an application is launched and connected to Radon"
      );
    }
    this.updateStartupMessage(StartupMessage.WaitingForAppToLoad);
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
    await this.launchApp(cancelToken);
  }

  private async restartDevice({ forceClean }: RestartOptions) {
    if (this.cancelToken) {
      this.cancelToken.cancel();
    }

    const cancelToken = new CancelToken();
    this.cancelToken = cancelToken;

    this.status = "starting";
    this.fatalError = undefined;
    this.updateStartupMessage(StartupMessage.InitializingDevice);

    await cancelToken.adapt(this.restartDebugger());
    this.updateStartupMessage(StartupMessage.BootingDevice);
    await cancelToken.adapt(this.device.reboot());
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

  private async restartDebugger() {
    await this.debugSession.restart();
  }

  private async launchApp(cancelToken: CancelToken) {
    const launchRequestTime = Date.now();
    getTelemetryReporter().sendTelemetryEvent("app:launch:requested", {
      platform: this.platform,
    });
    const launchConfig = this.applicationContext.launchConfig;

    // FIXME: Windows getting stuck waiting for the promise to resolve. This
    // seems like a problem with app connecting to Metro and using embedded
    // bundle instead.
    const shouldWaitForAppLaunch = launchConfig.preview.waitForAppLaunch;
    const launchArguments =
      (this.platform === DevicePlatform.IOS && launchConfig.ios?.launchArguments) || [];
    const waitForAppReady = shouldWaitForAppLaunch ? this.devtools.appReady() : Promise.resolve();

    this.updateStartupMessage(StartupMessage.Launching);
    await cancelToken.adapt(
      this.device.launchApp(this.buildResult, this.metro.port, this.devtools.port, launchArguments)
    );

    Logger.debug("Will wait for app ready and for preview");
    this.updateStartupMessage(StartupMessage.WaitingForAppToLoad);

    let previewURL: string | undefined;
    if (shouldWaitForAppLaunch) {
      const reportWaitingStuck = setTimeout(() => {
        Logger.info(
          "App is taking very long to boot up, it might be stuck. Device preview URL:",
          previewURL
        );
        getTelemetryReporter().sendTelemetryEvent("app:launch:waiting-stuck", {
          platform: this.platform,
        });
      }, 30000);
      waitForAppReady.then(() => clearTimeout(reportWaitingStuck));
    }

    await cancelToken.adapt(
      Promise.all([
        this.metro.ready(),
        this.device.startPreview().then((url) => {
          if (!url) {
            throw new Error("Device preview URL is not available");
          }
          previewURL = url;
          // initialise device rotation
          this.sendRotate(this.rotation);
        }),
        waitForAppReady,
      ])
    );

    Logger.debug("App and preview ready, moving on...");
    this.updateStartupMessage(StartupMessage.AttachingDebugger);
    if (this.isActive) {
      await cancelToken.adapt(this.connectJSDebugger());
    }

    const launchDurationSec = (Date.now() - launchRequestTime) / 1000;
    Logger.info("App launched in", launchDurationSec.toFixed(2), "sec.");
    getTelemetryReporter().sendTelemetryEvent(
      "app:launch:completed",
      { platform: this.platform },
      { durationSec: launchDurationSec }
    );
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

      if (this.cancelToken) {
        this.cancelToken.cancel();
      }

      const cancelToken = new CancelToken();
      this.cancelToken = cancelToken;

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

      if (this.isActive) {
        await cancelToken.adapt(this.debugSession.startParentDebugSession());
      }

      await cancelToken.adapt(this.waitForMetroReady());
      // TODO(jgonet): Build and boot simultaneously, with predictable state change updates
      await cancelToken.adapt(this.bootDevice());
      await this.buildApp({
        clean: false,
        cancelToken,
      });
      await cancelToken.adapt(this.installApp({ reinstall: false }));
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
      this.status = "running";
      this.emitStateChange();
      Logger.debug("Connected to debugger, moving on...");
    } else {
      Logger.error("Couldn't connect to debugger");
    }
  }

  private async saveAndOpenCPUProfile(tempFilePath: string) {
    // Show save dialog to save the profile file to the workspace folder:
    let defaultUri = Uri.file(tempFilePath);
    const workspaceFolder = workspace.workspaceFolders?.[0];
    if (workspaceFolder) {
      defaultUri = Uri.file(path.join(workspaceFolder.uri.fsPath, path.basename(tempFilePath)));
    }

    const saveDialog = await window.showSaveDialog({
      defaultUri,
      filters: {
        "CPU Profile": ["cpuprofile"],
      },
    });

    if (saveDialog) {
      await fs.promises.copyFile(tempFilePath, saveDialog.fsPath);
      commands.executeCommand("vscode.open", Uri.file(saveDialog.fsPath));

      // verify whether flame chart visualizer extension is installed
      // flame chart visualizer is not necessary to open the cpuprofile file, but when it is installed,
      // the user can use the flame button from cpuprofile view to visualize it differently
      const flameChartExtension = extensions.getExtension("ms-vscode.vscode-js-profile-flame");
      if (!flameChartExtension) {
        const GO_TO_EXTENSION_BUTTON = "Go to Extension";
        window
          .showInformationMessage(
            "Flame Chart Visualizer extension is not installed. It is recommended to install it for better profiling insights.",
            GO_TO_EXTENSION_BUTTON
          )
          .then((action) => {
            if (action === GO_TO_EXTENSION_BUTTON) {
              commands.executeCommand(
                "workbench.extensions.search",
                "ms-vscode.vscode-js-profile-flame"
              );
            }
          });
      }
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
    }
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
    this.rotation = rotation;
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
    const listener = this.devtools.onEvent("inspectData", (payload) => {
      if (payload.id === id) {
        listener.dispose();
        callback(payload);
      }
    });
    this.inspectorBridge.sendInspectRequest(xRatio, yRatio, id, requestStack);
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

  public async updateToolEnabledState(toolName: ToolKey, enabled: boolean) {
    this.toolsManager.updateToolEnabledState(toolName, enabled);
  }

  public async openStorybookStory(componentTitle: string, storyName: string) {
    await this.inspectorBridge.sendShowStorybookStoryRequest(componentTitle, storyName);
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
