import { Disposable } from "vscode";
import { Metro } from "./metro";
import { Devtools } from "./devtools";
import { DeviceBase } from "../devices/DeviceBase";
import { Logger } from "../Logger";
import { BuildManager, BuildResult, DisposableBuild } from "../builders/BuildManager";
import { AppPermissionType, DeviceSettings, StartupMessage } from "../common/Project";
import { DevicePlatform } from "../common/DeviceManager";
import { AndroidEmulatorDevice } from "../devices/AndroidEmulatorDevice";
import { getLaunchConfiguration } from "../utilities/launchConfiguration";
import { DebugSession, DebugSessionDelegate } from "../debugging/DebugSession";
import { throttle } from "../utilities/throttle";
import { DependencyManager } from "../dependency/DependencyManager";

type PerformAction =
  | "rebuild"
  | "reboot"
  | "reinstall"
  | "restartProcess"
  | "reloadJs"
  | "hotReload";

type StartOptions = { cleanBuild: boolean };

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

export class DeviceSession implements Disposable {
  private inspectCallID = 7621;
  private maybeBuildResult: BuildResult | undefined;
  private debugSession: DebugSession | undefined;
  private disposableBuild: DisposableBuild<BuildResult> | undefined;
  private buildManager: BuildManager;

  private get buildResult() {
    if (!this.maybeBuildResult) {
      throw new Error("Expecting build to be ready");
    }
    return this.maybeBuildResult;
  }

  constructor(
    private readonly device: DeviceBase,
    private readonly devtools: Devtools,
    private readonly metro: Metro,
    readonly dependencyManager: DependencyManager,
    private readonly debugEventDelegate: DebugSessionDelegate,
    private readonly eventDelegate: EventDelegate
  ) {
    this.buildManager = new BuildManager(dependencyManager);
    this.devtools.addListener((event, payload) => {
      switch (event) {
        case "RNIDE_appReady":
          Logger.debug("App ready");
          break;
        case "RNIDE_navigationChanged":
          this.eventDelegate.onAppEvent("navigationChanged", payload);
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

  public async perform(type: PerformAction) {
    switch (type) {
      case "reinstall":
        await this.installApp({ reinstall: true });
        await this.launchApp();
        return true;
      case "restartProcess":
        await this.launchApp();
        return true;
      case "hotReload":
        if (this.devtools.hasConnectedClient) {
          await this.metro.reload();
          return true;
        }
        return false;
    }
    throw new Error("Not implemented " + type);
  }

  private async launchApp() {
    const shouldWaitForAppLaunch = getLaunchConfiguration().preview?.waitForAppLaunch !== false;
    const waitForAppReady = shouldWaitForAppLaunch ? this.devtools.appReady() : Promise.resolve();

    this.eventDelegate.onStateChange(StartupMessage.Launching);
    await this.device.launchApp(this.buildResult, this.metro.port, this.devtools.port);

    Logger.debug("Will wait for app ready and for preview");
    this.eventDelegate.onStateChange(StartupMessage.WaitingForAppToLoad);
    const [previewUrl] = await Promise.all([this.device.startPreview(), waitForAppReady]);
    Logger.debug("App and preview ready, moving on...");
    this.eventDelegate.onStateChange(StartupMessage.AttachingDebugger);
    await this.startDebugger();
    return previewUrl;
  }

  private async bootDevice(deviceSettings: DeviceSettings) {
    this.eventDelegate.onStateChange(StartupMessage.BootingDevice);
    await this.device.bootDevice();
    await this.device.changeSettings(deviceSettings);
  }

  private async buildApp({ clean }: { clean: boolean }) {
    this.eventDelegate.onStateChange(StartupMessage.Building);
    this.disposableBuild = this.buildManager.startBuild(this.device.deviceInfo, {
      clean,
      onSuccess: this.eventDelegate.onBuildSuccess,
      progressListener: throttle((stageProgress: number) => {
        this.eventDelegate.onBuildProgress(stageProgress);
      }, 100),
    });
    this.maybeBuildResult = await this.disposableBuild.build;
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

  public async start(deviceSettings: DeviceSettings, { cleanBuild }: StartOptions) {
    await this.waitForMetroReady();
    // TODO(jgonet): Build and boot simultaneously, with predictable state change updates
    await this.bootDevice(deviceSettings);
    await this.buildApp({ clean: cleanBuild });
    await this.installApp({ reinstall: false });
    const previewUrl = await this.launchApp();
    Logger.debug("Device session started");
    return previewUrl;
  }

  private async startDebugger() {
    const websocketAddress = await this.metro.getDebuggerURL();
    if (websocketAddress) {
      this.debugSession = new DebugSession(websocketAddress, this.debugEventDelegate);
      const started = await this.debugSession.start();
      if (started) {
        // TODO(jgonet): Right now, we ignore start failure
        Logger.debug("Connected to debugger, moving on...");
      }
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

  public resetAppPermissions(permissionType: AppPermissionType) {
    if (this.maybeBuildResult) {
      return this.device.resetAppPermissions(permissionType, this.maybeBuildResult);
    }
    return false;
  }

  public sendTouch(xRatio: number, yRatio: number, type: "Up" | "Move" | "Down") {
    this.device.sendTouch(xRatio, yRatio, type);
  }

  public sendMultiTouch(
    xRatio: number,
    yRatio: number,
    xAnchorRatio: number,
    yAnchorRatio: number,
    type: "Up" | "Move" | "Down"
  ) {
    this.device.sendMultiTouch(xRatio, yRatio, xAnchorRatio, yAnchorRatio, type);
  }

  public sendKey(keyCode: number, direction: "Up" | "Down") {
    this.device.sendKey(keyCode, direction);
  }

  public sendPaste(text: string) {
    this.device.sendPaste(text);
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
    // on iOS, we can load native module and dispatch dev menu show method. On
    // Android, this native module isn't available and we need to fallback to
    // adb to send "menu key" (code 82) to trigger code path showing the menu.
    //
    // We could probably unify it in the future by running metro in interactive
    // mode and sending keys to stdin.
    if (this.device.platform === DevicePlatform.IOS) {
      this.devtools.send("RNIDE_iosDevMenu");
    } else {
      await (this.device as AndroidEmulatorDevice).openDevMenu();
    }
  }

  public startPreview(previewId: string) {
    this.devtools.send("RNIDE_openPreview", { previewId });
  }

  public onActiveFileChange(filename: string, followEnabled: boolean) {
    this.devtools.send("RNIDE_editorFileChanged", { filename, followEnabled });
  }

  public async changeDeviceSettings(settings: DeviceSettings) {
    await this.device.changeSettings(settings);
  }

  public focusBuildOutput() {
    this.buildManager.focusBuildOutput();
  }
}
