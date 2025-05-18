import _ from "lodash";
import { commands, DebugSessionCustomEvent, Disposable, workspace } from "vscode";
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
import { getLaunchConfiguration } from "../utilities/launchConfiguration";
import { DebugSession, DebugSessionDelegate, DebugSource } from "../debugging/DebugSession";
import { throttle } from "../utilities/throttle";
import { DependencyManager } from "../dependency/DependencyManager";
import { getTelemetryReporter } from "../utilities/telemetry";
import { BuildCache } from "../builders/BuildCache";
import { CancelError, CancelToken } from "../builders/cancelToken";
import { DevicePlatform } from "../common/DeviceManager";
import { ToolsDelegate, ToolsManager } from "./tools";
import { extensionContext } from "../utilities/extensionContext";
import {
  AppPermissionType,
  DeviceButtonType,
  DeviceSettings,
  ReloadAction,
  TouchPoint,
} from "../common/DeviceSessionsManager";
import { PanelLocation } from "../common/WorkspaceConfig";
import { focusSource } from "../utilities/focusSource";
import { DeviceManager } from "../devices/DeviceManager";
import {
  AppEvent,
  DEVICE_SETTINGS_DEFAULT,
  DeviceBootError,
  DeviceSessionInterface,
  DeviceState,
  RestartOptions,
  StartOptions,
  StartupMessage,
} from "../common/DeviceSession";

const DEVICE_SETTINGS_KEY = "device_settings_v4";

export type DeviceSessionDelegate = {
  ensureDependenciesAndNodeVersion(): Promise<void>;
  onConsoleLog(event: DebugSessionCustomEvent): void;
  onProfilingCPUStarted(event: DebugSessionCustomEvent): void;
  onProfilingCPUStopped(event: DebugSessionCustomEvent): void;
  onDeviceSettingChanged(settings: DeviceSettings): void;
  onDeviceStateChanged(newState: DeviceState): void;
  onNavigationChanged(payload: AppEvent["navigationChanged"]): void;
} & ToolsDelegate &
  BuildManagerDelegate;

export class DeviceSession
  implements DeviceSessionInterface, MetroDelegate, DebugSessionDelegate, Disposable
{
  public metro: MetroLauncher;
  public toolsManager: ToolsManager;
  private inspectCallID = 7621;
  private maybeBuildResult: BuildResult | undefined;
  public devtools;
  private debugSession: DebugSession | undefined;
  private disposableBuild: DisposableBuild<BuildResult> | undefined;
  private buildManager: BuildManager;
  public deviceSettings: DeviceSettings;
  private isLaunching = true;
  private cancelToken: CancelToken | undefined;

  private deviceState: DeviceState = {
    isActive: false,
    status: "starting",
    stageProgress: 0,
    startupMessage: StartupMessage.InitializingDevice,
    previewURL: undefined,
    initialized: false,
    isProfilingCPU: false,
    isRecording: false,
  };

  public getDeviceState() {
    return this.deviceState;
  }

  private updateDeviceState(newState: Partial<DeviceState>) {
    // NOTE: this is unsafe, but I'm not sure there's a way to enforce the type of `newState` correctly
    const mergedState: any = { ...this.deviceState, ...newState };
    // stageProgress is tied to a startup stage, so when there is a change of status or startupMessage,
    // we always want to reset the progress.
    if (
      newState.status !== undefined ||
      ("startupMessage" in newState && newState.startupMessage !== undefined)
    ) {
      delete mergedState.stageProgress;
    }
    this.deviceState = mergedState;
    this.deviceSessionDelegate.onDeviceStateChanged(this.deviceState);
  }

  private reportStageProgress(stageProgress: number, stage: string) {
    if (stage !== this.deviceState.startupMessage) {
      return;
    }
    this.updateDeviceState({ stageProgress });
  }

  public onBuildProgress = (stageProgress: number): void => {
    this.reportStageProgress(stageProgress, StartupMessage.Building);
  };

  public onBundleProgress = throttle((stageProgress: number) => {
    this.reportStageProgress(stageProgress, StartupMessage.WaitingForAppToLoad);
  }, 100);

  onAppEvent = (event: keyof AppEvent, payload: AppEvent[typeof event]): void => {
    switch (event) {
      case "navigationChanged":
        this.deviceSessionDelegate.onNavigationChanged(payload as AppEvent[typeof event]);
        break;
      case "fastRefreshStarted":
        this.updateDeviceState({ status: "refreshing" });
        break;
      case "fastRefreshComplete":
        const ignoredEvents = ["starting", "bundlingError"];
        if (ignoredEvents.includes(this.deviceState.status)) {
          return;
        }
        this.updateDeviceState({ status: "running" });
        break;
    }
  };

  public onReloadStarted(): void {
    this.updateDeviceState({
      status: "starting",
      startupMessage: StartupMessage.Restarting,
    });
  }

  public onReloadCompleted(): void {
    this.updateDeviceState({
      status: "running",
    });
  }

  public onDebuggerPaused(event: DebugSessionCustomEvent) {
    this.updateDeviceState({ status: "debuggerPaused" });

    // we don't want to focus on debug side panel if it means hiding Radon IDE
    const panelLocation = workspace
      .getConfiguration("RadonIDE")
      .get<PanelLocation>("panelLocation");

    if (panelLocation === "tab") {
      commands.executeCommand("workbench.view.debug");
    }
  }

  public onDebuggerResumed() {
    const ignoredEvents = ["starting", "bundlingError"];
    if (ignoredEvents.includes(this.deviceState.status)) {
      return;
    }
    this.updateDeviceState({ status: "running" });
  }

  public onConsoleLog(event: DebugSessionCustomEvent) {
    this.deviceSessionDelegate.onConsoleLog(event);
  }

  public onProfilingCPUStarted(event: DebugSessionCustomEvent) {
    this.updateDeviceState({ isProfilingCPU: true });
    this.deviceSessionDelegate.onProfilingCPUStarted(event);
  }

  public async onProfilingCPUStopped(event: DebugSessionCustomEvent) {
    this.updateDeviceState({ isProfilingCPU: false });
    await this.deviceSessionDelegate.onProfilingCPUStopped(event);
  }

  async onBundlingError(
    message: string,
    source: DebugSource,
    _errorModulePath: string
  ): Promise<void> {
    await this.appendDebugConsoleEntry(message, "error", source);

    if (this.deviceState.status === "starting" && this.deviceState.isActive) {
      focusSource(source);
    }

    Logger.error("[Bundling Error]", message);

    this.updateDeviceState({ status: "bundlingError" });
  }

  onReloadRequested(type: ReloadAction) {
    this.updateDeviceState({ status: "starting", startupMessage: StartupMessage.Restarting });

    getTelemetryReporter().sendTelemetryEvent("url-bar:reload-requested", {
      platform: this.device.platform,
      method: type,
    });
  }

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

  public get platform() {
    return this.device.platform;
  }

  constructor(
    private readonly appRootFolder: string,
    private readonly deviceManager: DeviceManager,
    private readonly device: DeviceBase,
    readonly dependencyManager: DependencyManager,
    readonly buildCache: BuildCache,
    private readonly deviceSessionDelegate: DeviceSessionDelegate
  ) {
    this.deviceSettings =
      extensionContext.workspaceState.get(DEVICE_SETTINGS_KEY) ?? DEVICE_SETTINGS_DEFAULT;

    this.devtools = this.makeDevtools();
    this.metro = new MetroLauncher(this.devtools, this);
    this.toolsManager = new ToolsManager(this.devtools, deviceSessionDelegate);

    this.buildManager = new BuildManager(
      dependencyManager,
      buildCache,
      deviceSessionDelegate,
      device.platform
    );
  }

  private makeDevtools() {
    const devtools = new Devtools();
    devtools.onEvent("RNIDE_appReady", () => {
      Logger.debug("App ready");
    });
    // We don't need to store event disposables here as they are tied to the lifecycle
    // of the devtools instance, which is disposed when we recreate the devtools or
    // when the device session is disposed
    devtools.onEvent("RNIDE_navigationChanged", (payload) => {
      this.onAppEvent("navigationChanged", payload);
    });
    devtools.onEvent("RNIDE_fastRefreshStarted", () => {
      this.onAppEvent("fastRefreshStarted", undefined);
    });
    devtools.onEvent("RNIDE_fastRefreshComplete", () => {
      this.onAppEvent("fastRefreshComplete", undefined);
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

  private onAppLaunched: (() => Promise<void>) | undefined = undefined;

  public async activate() {
    this.updateDeviceState({ isActive: true });
    this.buildManager.activate();
    this.toolsManager.activate();
    this.debugSession = new DebugSession(this);
    await this.debugSession.startParentDebugSession();
    if (this.deviceState.status === "running") {
      await this.connectJSDebugger();
    } else {
      this.onAppLaunched = async () => {
        this.updateDeviceState({ startupMessage: StartupMessage.AttachingDebugger });
        await this.connectJSDebugger();
      };
    }
  }

  public async deactivate() {
    this.onAppLaunched = undefined;
    this.updateDeviceState({ isActive: false });
    await this.debugSession?.dispose();
    this.debugSession = undefined;
    this.buildManager.deactivate();
    this.toolsManager.deactivate();
  }

  public async perform(type: ReloadAction): Promise<boolean> {
    let result = false;
    try {
      switch (type) {
        case "autoReload":
          await this.autoReload();
          result = true;
          break;
        case "reboot":
          await this.restart({ forceClean: false, cleanCache: false });
          result = true;
          break;
        case "clearMetro":
          await this.restart({ forceClean: false, cleanCache: true });
          result = true;
          break;
        case "rebuild":
          await this.restart({ forceClean: true, cleanCache: false });
          result = true;
          break;
        case "reinstall":
          await this.reinstallApp();
          result = true;
          break;
        case "restartProcess":
          result = await this.restartProcess();
          break;
        case "reloadJs":
          result = await this.reloadJS();
          break;
      }
    } catch (e) {
      Logger.debug("[Reload]", e);
      throw e;
    }
    if (result) {
      this.updateDeviceState({ status: "running" });
    }
    return result;
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
      this.toolsManager = new ToolsManager(this.devtools, this.deviceSessionDelegate);
      oldToolsManager.dispose();
      oldDevtools.dispose();
      oldMetro.dispose();

      Logger.debug(`Launching devtools`);
      this.devtools.start();

      Logger.debug(`Launching metro`);
      this.metro.start({
        resetCache: true,
        appRoot: this.appRootFolder,
        dependencies: [],
      });
    }

    await cancelToken.adapt(this.restartDebugger());
    this.updateDeviceState({ startupMessage: StartupMessage.BootingDevice });
    await cancelToken.adapt(this.device.reboot());
    await this.buildApp({ appRoot: this.appRootFolder, clean: forceClean, cancelToken });
    await this.installApp({ reinstall: false });
    await this.launchApp(cancelToken);
    Logger.debug("Device session started");
  }

  private async autoReload() {
    getTelemetryReporter().sendTelemetryEvent("url-bar:restart-requested", {
      platform: this.device.platform,
    });

    this.onReloadStarted();

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
        this.onReloadCompleted();
      }
    } catch (e) {
      // finally in case of any errors, the last resort is performing project
      // restart and device selection (we still avoid forcing clean builds, and
      // only do clean build when explicitly requested).
      // before doing anything, we check if the device hasn't been updated in the meantime
      // which might have initiated a new session anyway
      await this.restart({ forceClean: false, cleanCache: false });
    }
  }

  private async restartDebugger() {
    await this.debugSession?.restart();
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
        const isRuntimeResponding = await this.debugSession?.pingJsDebugSessionWithTimeout();
        if (isRuntimeResponding) {
          return;
        }
      }
    }
    await this.connectJSDebugger();
  }

  private async reloadMetro() {
    this.updateDeviceState({ startupMessage: StartupMessage.WaitingForAppToLoad });
    await Promise.all([this.metro.reload(), this.devtools.appReady()]);
    this.updateDeviceState({ startupMessage: StartupMessage.AttachingDebugger });
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

    this.updateDeviceState({ startupMessage: StartupMessage.Launching });
    await cancelToken.adapt(
      this.device.launchApp(this.buildResult, this.metro.port, this.devtools.port)
    );

    Logger.debug("Will wait for app ready and for preview");
    this.updateDeviceState({ startupMessage: StartupMessage.WaitingForAppToLoad });

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
          this.updateDeviceState({ previewURL });
        }),
        waitForAppReady,
      ])
    );

    Logger.debug("App and preview ready, moving on...");
    this.isLaunching = false;

    if (this.deviceSettings?.replaysEnabled) {
      this.device.enableReplay();
    }
    if (this.deviceSettings?.showTouches) {
      this.device.showTouches();
    }

    if (this.onAppLaunched) {
      await cancelToken.adapt(this.onAppLaunched());
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
    this.updateDeviceState({ startupMessage: StartupMessage.BootingDevice });
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
    this.updateDeviceState({ startupMessage: StartupMessage.Building });
    this.disposableBuild = this.buildManager.startBuild(this.device.deviceInfo, {
      appRoot,
      clean,
      progressListener: throttle((stageProgress: number) => {
        this.onBuildProgress(stageProgress);
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
    this.updateDeviceState({ startupMessage: StartupMessage.Installing });
    return this.device.installApp(this.buildResult, reinstall);
  }

  private async waitForMetroReady() {
    this.updateDeviceState({ startupMessage: StartupMessage.StartingPackager });
    // wait for metro/devtools to start before we continue
    await Promise.all([this.metro.ready(), this.devtools.ready()]);
    Logger.debug("Metro & devtools ready");
  }

  public async start({ cleanBuild, resetMetroCache }: StartOptions) {
    this.updateDeviceState({
      initialized: true,
      status: "starting",
      startupMessage: StartupMessage.InitializingDevice,
      previewURL: undefined,
    });
    try {
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
        appRoot: this.appRootFolder,
        dependencies: [waitForNodeModules],
      });

      await cancelToken.adapt(this.waitForMetroReady());
      // TODO(jgonet): Build and boot simultaneously, with predictable state change updates
      await cancelToken.adapt(this.bootDevice(this.deviceSettings));
      await this.buildApp({ appRoot: this.appRootFolder, clean: cleanBuild, cancelToken });
      await cancelToken.adapt(this.installApp({ reinstall: false }));
      const previewURL = await this.launchApp(cancelToken);

      Logger.debug("Device session started");
      this.updateDeviceState({
        previewURL,
        status: "running",
      });
    } catch (e) {
      Logger.error("Couldn't start device session", e instanceof Error ? e.message : e);
      if (e instanceof CancelError) {
        Logger.debug("[SelectDevice] Device start was canceled", e);
      } else if (e instanceof DeviceBootError) {
        this.updateDeviceState({ status: "bootError" });
      } else if (e instanceof BuildError) {
        this.updateDeviceState({
          status: "buildError",
          buildError: {
            message: e.message,
            buildType: e.buildType,
            platform: this.device.platform,
          },
        });
      } else {
        this.updateDeviceState({
          status: "buildError",
          buildError: {
            message: (e as Error).message,
            buildType: null,
            platform: this.device.platform,
          },
        });
      }
    }
  }

  private async connectJSDebugger() {
    const websocketAddress = await this.metro.getDebuggerURL();
    if (!websocketAddress) {
      Logger.error("Couldn't find a proper debugger URL to connect to");
      return;
    }
    const connected = await this.debugSession?.startJSDebugSession({
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
    this.updateDeviceState({ isRecording: true });
    return this.device.startRecording();
  }

  public async captureAndStopRecording() {
    this.updateDeviceState({ isRecording: false });
    return this.device.captureAndStopRecording();
  }

  public async captureReplay() {
    return this.device.captureReplay();
  }

  public async captureScreenshot() {
    return this.device.captureScreenshot();
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

    this.deviceSessionDelegate.onDeviceSettingChanged(settings);
    return this.device.changeSettings(settings);
  }

  public focusBuildOutput() {
    this.buildManager.focusBuildOutput();
  }

  public async sendBiometricAuthorization(isMatch: boolean) {
    await this.device.sendBiometricAuthorization(isMatch);
  }
}
