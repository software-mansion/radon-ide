import _ from "lodash";
import { Disposable } from "vscode";
import { MetroLauncher, MetroDelegate } from "./metro";
import { Devtools } from "./devtools";
import { DeviceBase } from "../devices/DeviceBase";
import { Logger } from "../Logger";
import {
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
} from "../common/Project";
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
import { ReloadAction } from "../common/DeviceSessionsManager";

const DEVICE_SETTINGS_KEY = "device_settings_v4";

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

type PreviewReadyCallback = (previewURL: string) => void;
type StartOptions = {
  cleanBuild: boolean;
  resetMetroCache: boolean;
  previewReadyCallback: PreviewReadyCallback;
};

type RestartOptions = {
  forceClean: boolean;
  cleanCache: boolean;
};

export type AppEvent = {
  navigationChanged: { displayName: string; id: string };
  fastRefreshStarted: undefined;
  fastRefreshComplete: undefined;
  isProfilingReact: boolean;
  isSavingReactProfile: boolean;
};

export type DeviceSessionDelegate = {
  onAppEvent<E extends keyof AppEvent, P = AppEvent[E]>(event: E, payload: P): void;
  onStateChange(state: StartupMessage): void;
  onReloadStarted(id: string): void;
  onReloadCompleted(id: string): void;
  onPreviewReady(previewURL: string): void;
  onBuildProgress(stageProgress: number): void;
  onDeviceSettingChanged(settings: DeviceSettings): void;
  ensureDependenciesAndNodeVersion(): Promise<void>;
} & MetroDelegate &
  ToolsDelegate &
  DebugSessionDelegate &
  BuildManagerDelegate;

export class DeviceBootError extends Error {
  constructor(
    message: string,
    public readonly cause: unknown
  ) {
    super(message);
  }
}

export class DeviceSession implements Disposable {
  public metro: MetroLauncher;
  public toolsManager: ToolsManager;
  private isActive: boolean = false;
  private inspectCallID = 7621;
  private maybeBuildResult: BuildResult | undefined;
  public devtools;
  private debugSession: DebugSession;
  private disposableBuild: DisposableBuild<BuildResult> | undefined;
  private buildManager: BuildManager;
  public deviceSettings: DeviceSettings;
  private isLaunching = true;
  private cancelToken: CancelToken | undefined;

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
    private readonly appRootFolder: string,
    private readonly device: DeviceBase,
    readonly dependencyManager: DependencyManager,
    readonly buildCache: BuildCache,
    debugEventDelegate: DebugSessionDelegate,
    private readonly deviceSessionDelegate: DeviceSessionDelegate,
    private readonly metroDelegate: MetroDelegate,
    private readonly toolsDelegate: ToolsDelegate
  ) {
    this.deviceSettings =
      extensionContext.workspaceState.get(DEVICE_SETTINGS_KEY) ?? DEVICE_SETTINGS_DEFAULT;

    this.devtools = this.makeDevtools();
    this.metro = new MetroLauncher(this.devtools, metroDelegate);
    this.toolsManager = new ToolsManager(this.devtools, toolsDelegate);

    this.buildManager = new BuildManager(
      dependencyManager,
      buildCache,
      deviceSessionDelegate,
      device.platform
    );
    this.debugSession = new DebugSession(debugEventDelegate, { useParentDebugSession: true });
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
      this.deviceSessionDelegate.onAppEvent("navigationChanged", payload);
    });
    devtools.onEvent("RNIDE_fastRefreshStarted", () => {
      this.deviceSessionDelegate.onAppEvent("fastRefreshStarted", undefined);
    });
    devtools.onEvent("RNIDE_fastRefreshComplete", () => {
      this.deviceSessionDelegate.onAppEvent("fastRefreshComplete", undefined);
    });
    devtools.onEvent("RNIDE_isProfilingReact", (isProfiling) => {
      this.deviceSessionDelegate.onAppEvent("isProfilingReact", isProfiling);
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
    this.debugSession = new DebugSession(this.deviceSessionDelegate);
    await this.debugSession.startParentDebugSession();
    await this.connectJSDebugger();
  }

  public async deactivate() {
    this.isActive = false;
    await this.debugSession.dispose();
    this.buildManager.deactivate();
    this.toolsManager.deactivate();
  }

  public async perform(type: ReloadAction): Promise<boolean> {
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
    throw new Error("Not implemented " + type);
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
      this.metro = new MetroLauncher(this.devtools, this.metroDelegate);
      this.toolsManager = new ToolsManager(this.devtools, this.toolsDelegate);
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
    this.deviceSessionDelegate.onStateChange(StartupMessage.BootingDevice);
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

    this.deviceSessionDelegate.onReloadStarted(this.device.deviceInfo.id);

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
        this.deviceSessionDelegate.onReloadCompleted(this.device.deviceInfo.id);
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
    this.deviceSessionDelegate.onStateChange(StartupMessage.WaitingForAppToLoad);
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
    this.deviceSessionDelegate.onStateChange(StartupMessage.AttachingDebugger);
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

    this.deviceSessionDelegate.onStateChange(StartupMessage.Launching);
    await cancelToken.adapt(
      this.device.launchApp(this.buildResult, this.metro.port, this.devtools.port)
    );

    Logger.debug("Will wait for app ready and for preview");
    this.deviceSessionDelegate.onStateChange(StartupMessage.WaitingForAppToLoad);

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
          this.deviceSessionDelegate.onPreviewReady(url);
        }),
        waitForAppReady,
      ])
    );

    Logger.debug("App and preview ready, moving on...");
    this.deviceSessionDelegate.onStateChange(StartupMessage.AttachingDebugger);
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
    this.deviceSessionDelegate.onStateChange(StartupMessage.BootingDevice);
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
    this.deviceSessionDelegate.onStateChange(StartupMessage.Building);
    this.disposableBuild = this.buildManager.startBuild(this.device.deviceInfo, {
      appRoot,
      clean,
      progressListener: throttle((stageProgress: number) => {
        this.deviceSessionDelegate.onBuildProgress(stageProgress);
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
    this.deviceSessionDelegate.onStateChange(StartupMessage.Installing);
    return this.device.installApp(this.buildResult, reinstall);
  }

  private async waitForMetroReady() {
    this.deviceSessionDelegate.onStateChange(StartupMessage.StartingPackager);
    // wait for metro/devtools to start before we continue
    await Promise.all([this.metro.ready(), this.devtools.ready()]);
    Logger.debug("Metro & devtools ready");
  }

  public async start({ cleanBuild, resetMetroCache, previewReadyCallback }: StartOptions) {
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
    // We start the debug session early to be able to use it to surface bundle
    // errors in the console. We only start the parent debug session and the JS
    // debugger will be started at later time once the app is built and launched.
    await cancelToken.adapt(this.debugSession.startParentDebugSession());

    await cancelToken.adapt(this.waitForMetroReady());
    // TODO(jgonet): Build and boot simultaneously, with predictable state change updates
    await cancelToken.adapt(this.bootDevice(this.deviceSettings));
    await this.buildApp({ appRoot: this.appRootFolder, clean: cleanBuild, cancelToken });
    await cancelToken.adapt(this.installApp({ reinstall: false }));
    const previewUrl = await this.launchApp(cancelToken);
    Logger.debug("Device session started");
    return previewUrl;
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
