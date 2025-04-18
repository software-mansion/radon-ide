import { Disposable } from "vscode";
import { MetroLauncher } from "./metro";
import { Devtools } from "./devtools";
import { DeviceBase } from "../devices/DeviceBase";
import { Logger } from "../Logger";
import { BuildManager, BuildResult, DisposableBuild } from "../builders/BuildManager";
import {
  AppPermissionType,
  DeviceSettings,
  ReloadAction,
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
import { CancelToken } from "../builders/cancelToken";
import { DevicePlatform } from "../common/DeviceManager";
import { disposeAll } from "../utilities/disposables";
type PreviewReadyCallback = (previewURL: string) => void;
type StartOptions = { cleanBuild: boolean; previewReadyCallback: PreviewReadyCallback };

export type AppEvent = {
  navigationChanged: { displayName: string; id: string };
  fastRefreshStarted: undefined;
  fastRefreshComplete: undefined;
};

export type EventDelegate = {
  onAppEvent<E extends keyof AppEvent, P = AppEvent[E]>(event: E, payload: P): void;
  onStateChange(state: StartupMessage): void;
  onBuildProgress(stageProgress: number): void;
  onBuildSuccess(): void;
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
  private inspectCallID = 7621;
  private maybeBuildResult: BuildResult | undefined;
  private debugSession: DebugSession;
  private disposableBuild: DisposableBuild<BuildResult> | undefined;
  private buildManager: BuildManager;
  private deviceSettings: DeviceSettings | undefined;
  private isLaunching = true;
  private disposables: Disposable[] = [];

  private get buildResult() {
    if (!this.maybeBuildResult) {
      throw new Error("Expecting build to be ready");
    }
    return this.maybeBuildResult;
  }

  public get isAppLaunched() {
    return !this.isLaunching;
  }

  constructor(
    private readonly device: DeviceBase,
    private readonly devtools: Devtools,
    private readonly metro: MetroLauncher,
    readonly dependencyManager: DependencyManager,
    readonly buildCache: BuildCache,
    debugEventDelegate: DebugSessionDelegate,
    private readonly eventDelegate: EventDelegate
  ) {
    this.buildManager = new BuildManager(dependencyManager, buildCache);
    this.debugSession = new DebugSession(debugEventDelegate);
    this.disposables.push(
      this.devtools.addListener("RNIDE_appReady", () => {
        Logger.debug("App ready");
      })
    );
    this.disposables.push(
      this.devtools.addListener("RNIDE_navigationChanged", (payload) => {
        this.eventDelegate.onAppEvent("navigationChanged", payload);
      })
    );
    this.disposables.push(
      this.devtools.addListener("RNIDE_fastRefreshStarted", () => {
        this.eventDelegate.onAppEvent("fastRefreshStarted", undefined);
      })
    );
    this.disposables.push(
      this.devtools.addListener("RNIDE_fastRefreshComplete", () => {
        this.eventDelegate.onAppEvent("fastRefreshComplete", undefined);
      })
    );
  }

  /**
  This method is async to allow for awaiting it during restarts, please keep in mind tho that
  build in vscode dispose system ignores async keyword and works synchronously.
  */
  public async dispose() {
    await this.debugSession?.dispose();
    this.disposableBuild?.dispose();
    this.device?.dispose();
    disposeAll(this.disposables);
  }

  public async perform(type: ReloadAction) {
    switch (type) {
      case "reinstall":
        await this.restartDebugger();
        await this.installApp({ reinstall: true });
        await this.launchApp();
        return true;
      case "restartProcess":
        await this.restartDebugger();
        const launchSucceeded = await this.launchApp();
        if (!launchSucceeded) {
          return false;
        }
        return true;
      case "reloadJs":
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
    throw new Error("Not implemented " + type);
  }

  public async restartDebugger() {
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
    this.eventDelegate.onStateChange(StartupMessage.WaitingForAppToLoad);
    await Promise.all([this.metro.reload(), this.devtools.appReady()]);
    this.eventDelegate.onStateChange(StartupMessage.AttachingDebugger);
    await this.reconnectJSDebuggerIfNeeded();
  }

  private async launchApp(previewReadyCallback?: PreviewReadyCallback) {
    this.launchAppCancelToken && this.launchAppCancelToken.cancel();

    const launchCancelToken = new CancelToken();
    this.launchAppCancelToken = launchCancelToken;

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

    this.eventDelegate.onStateChange(StartupMessage.Launching);
    await this.device.launchApp(this.buildResult, this.metro.port, this.devtools.port);
    if (launchCancelToken.cancelled) {
      return undefined;
    }

    Logger.debug("Will wait for app ready and for preview");
    this.eventDelegate.onStateChange(StartupMessage.WaitingForAppToLoad);

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

    await Promise.all([
      this.metro.ready(),
      this.device.startPreview().then((url) => {
        previewURL = url;
        previewReadyCallback && previewReadyCallback(url);
      }),
      waitForAppReady,
    ]);
    if (launchCancelToken.cancelled) {
      return undefined;
    }

    Logger.debug("App and preview ready, moving on...");
    this.eventDelegate.onStateChange(StartupMessage.AttachingDebugger);
    await this.connectJSDebugger();
    if (launchCancelToken.cancelled) {
      return undefined;
    }

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
    this.eventDelegate.onStateChange(StartupMessage.BootingDevice);
    try {
      await this.device.bootDevice(deviceSettings);
    } catch (e) {
      Logger.error("Failed to boot device", e);
      throw new DeviceBootError("Failed to boot device", e);
    }
  }

  private async buildApp({ appRoot, clean }: { appRoot: string; clean: boolean }) {
    const buildStartTime = Date.now();
    this.eventDelegate.onStateChange(StartupMessage.Building);
    this.disposableBuild = this.buildManager.startBuild(this.device.deviceInfo, {
      appRoot,
      clean,
      onSuccess: this.eventDelegate.onBuildSuccess,
      progressListener: throttle((stageProgress: number) => {
        this.eventDelegate.onBuildProgress(stageProgress);
      }, 100),
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
    this.eventDelegate.onStateChange(StartupMessage.Installing);
    return this.device.installApp(this.buildResult, reinstall);
  }

  private async waitForMetroReady() {
    this.eventDelegate.onStateChange(StartupMessage.StartingPackager);
    // wait for metro/devtools to start before we continue
    await Promise.all([this.metro.ready(), this.devtools.ready()]);
    Logger.debug("Metro & devtools ready");
  }

  public async start(
    deviceSettings: DeviceSettings,
    appRoot: string,
    { cleanBuild, previewReadyCallback }: StartOptions
  ) {
    this.deviceSettings = deviceSettings;

    // We start the debug session early to be able to use it to surface bundle
    // errors in the console. We only start the parent debug session and the JS
    // debugger will be started at later time once the app is built and launched.
    await this.debugSession.startParentDebugSession();

    await this.waitForMetroReady();
    // TODO(jgonet): Build and boot simultaneously, with predictable state change updates
    await this.bootDevice(deviceSettings);
    await this.buildApp({ appRoot, clean: cleanBuild });
    await this.installApp({ reinstall: false });
    const previewUrl = await this.launchApp(previewReadyCallback);
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
    const listener = this.devtools.addListener("RNIDE_inspectData", (payload) => {
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
    const listener = this.devtools.addListener("RNIDE_openPreviewResult", (payload) => {
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
}
