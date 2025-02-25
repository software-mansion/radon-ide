import { Disposable } from "vscode";
import { Metro } from "./metro";
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
} from "../common/Project";
import { getLaunchConfiguration } from "../utilities/launchConfiguration";
import { DebugSession, DebugSessionDelegate } from "../debugging/DebugSession";
import { throttle } from "../utilities/throttle";
import { DependencyManager } from "../dependency/DependencyManager";
import { getTelemetryReporter } from "../utilities/telemetry";
import { BuildCache } from "../builders/BuildCache";
import { CancelToken } from "../builders/cancelToken";

type PreviewReadyCallback = (previewURL: string) => void;
type StartOptions = { cleanBuild: boolean; previewReadyCallback: PreviewReadyCallback };

export type AppEvent = {
  navigationChanged: { displayName: string; id: string };
  fastRefreshStarted: undefined;
  fastRefreshComplete: undefined;
  navigationInit: { displayName: string; id: string }[];
};

export type EventDelegate = {
  onAppEvent<E extends keyof AppEvent, P = AppEvent[E]>(event: E, payload: P): void;
  onStateChange(state: StartupMessage): void;
  onBuildProgress(stageProgress: number): void;
  onBuildSuccess(): void;
};

export class DeviceBootError extends Error {
  constructor(message: string, public readonly cause: unknown) {
    super(message);
  }
}

export class DeviceSession implements Disposable {
  private inspectCallID = 7621;
  private maybeBuildResult: BuildResult | undefined;
  private debugSession: DebugSession | undefined;
  private disposableBuild: DisposableBuild<BuildResult> | undefined;
  private buildManager: BuildManager;
  private deviceSettings: DeviceSettings | undefined;
  private isLaunching = true;

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
    private readonly metro: Metro,
    readonly dependencyManager: DependencyManager,
    readonly buildCache: BuildCache,
    private readonly debugEventDelegate: DebugSessionDelegate,
    private readonly eventDelegate: EventDelegate
  ) {
    this.buildManager = new BuildManager(dependencyManager, buildCache);
    this.devtools.addListener((event, payload) => {
      switch (event) {
        case "RNIDE_appReady":
          Logger.debug("App ready");
          break;
        case "RNIDE_navigationChanged":
          this.eventDelegate.onAppEvent("navigationChanged", payload);
          break;
        case "RNIDE_navigationInit":
          this.eventDelegate.onAppEvent("navigationInit", payload);
          break;
        case "RNIDE_fastRefreshStarted":
          this.eventDelegate.onAppEvent("fastRefreshStarted", undefined);
          break;
        case "RNIDE_fastRefreshComplete":
          this.eventDelegate.onAppEvent("fastRefreshComplete", undefined);
          break;
      }
    });
  }

  public dispose() {
    this.debugSession?.dispose();
    this.disposableBuild?.dispose();
    this.device?.dispose();
  }

  public async perform(type: ReloadAction) {
    switch (type) {
      case "reinstall":
        await this.installApp({ reinstall: true });
        await this.launchApp();
        return true;
      case "restartProcess":
        const launchSucceeded = await this.launchApp();
        if (!launchSucceeded) {
          return false;
        }
        return true;
      case "reloadJs":
        if (this.devtools.hasConnectedClient) {
          try {
            await this.metro.reload();
            return true;
          } catch (e) {
            Logger.error("Failed to reload JS", e);
          }
        }
        return false;
    }
    throw new Error("Not implemented " + type);
  }

  private launchAppCancelToken: CancelToken | undefined;

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
    await this.startDebugger();
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

  private async buildApp({ clean }: { clean: boolean }) {
    const buildStartTime = Date.now();
    this.eventDelegate.onStateChange(StartupMessage.Building);
    this.disposableBuild = this.buildManager.startBuild(this.device.deviceInfo, {
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
    { cleanBuild, previewReadyCallback }: StartOptions
  ) {
    this.deviceSettings = deviceSettings;
    await this.waitForMetroReady();
    // TODO(jgonet): Build and boot simultaneously, with predictable state change updates
    await this.bootDevice(deviceSettings);
    await this.buildApp({ clean: cleanBuild });
    await this.installApp({ reinstall: false });
    const previewUrl = await this.launchApp(previewReadyCallback);
    Logger.debug("Device session started");
    return previewUrl;
  }

  private async startDebugger() {
    if (this.debugSession) {
      this.debugSession.dispose();
    }
    this.debugSession = new DebugSession(this.metro, this.debugEventDelegate);
    const started = await this.debugSession.start();
    if (started) {
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

  public async resetAppPermissions(permissionType: AppPermissionType) {
    if (this.maybeBuildResult) {
      return this.device.resetAppPermissions(permissionType, this.maybeBuildResult);
    }
    return false;
  }

  public async sendDeepLink(link: string) {
    if (this.maybeBuildResult) {
      return this.device.sendDeepLink(link, this.maybeBuildResult);
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

  public sendTouches(touches: Array<TouchPoint>, type: "Up" | "Move" | "Down") {
    this.device.sendTouches(touches, type);
  }

  public sendKey(keyCode: number, direction: "Up" | "Down") {
    this.device.sendKey(keyCode, direction);
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
    const listener = (event: string, payload: any) => {
      if (event === "RNIDE_inspectData" && payload.id === id) {
        this.devtools?.removeListener(listener);
        callback(payload);
      }
    };
    this.devtools?.addListener(listener);
    this.devtools.send("RNIDE_inspect", { x: xRatio, y: yRatio, id, requestStack });
  }

  public openNavigation(id: string) {
    this.devtools.send("RNIDE_openNavigation", { id });
  }

  public async openDevMenu() {
    await this.metro.openDevMenu();
  }

  public async startPreview(previewId: string) {
    this.devtools.send("RNIDE_openPreview", { previewId });
    return new Promise<void>((res, rej) => {
      let listener = (event: string, payload: any) => {
        if (event === "RNIDE_openPreviewResult" && payload.previewId === previewId) {
          this.devtools?.removeListener(listener);
          if (payload.error) {
            rej(payload.error);
          } else {
            res();
          }
        }
      };
      this.devtools.addListener(listener);
    });
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
