import { Disposable } from "vscode";
import { Metro } from "./metro";
import { Devtools } from "./devtools";
import { DeviceBase } from "../devices/DeviceBase";
import { Logger } from "../Logger";
import { BuildResult, DisposableBuild } from "../builders/BuildManager";
import { AppPermissionType, DeviceSettings, StartupMessage } from "../common/Project";
import { DevicePlatform } from "../common/DeviceManager";
import { AndroidEmulatorDevice } from "../devices/AndroidEmulatorDevice";
import { getLaunchConfiguration } from "../utilities/launchConfiguration";
import { DebugSession, DebugSessionDelegate } from "../debugging/DebugSession";

type PreviewReadyCallback = (previewURL: string) => void;

type PerformAction =
  | "rebuild"
  | "reboot"
  | "reinstall"
  | "restartProcess"
  | "reloadJs"
  | "hotReload";

export type AppEvent = {
  navigationChanged: { displayName: string; id: string };
  fastRefreshStarted: undefined;
  fastRefreshComplete: undefined;
};

export type EventDelegate = {
  onAppEvent<E extends keyof AppEvent, P = AppEvent[E]>(event: E, payload: P): void;
  onStateChange(state: StartupMessage): void;
};
export class DeviceSession implements Disposable {
  private inspectCallID = 7621;
  private buildResult: BuildResult | undefined;
  private debugSession: DebugSession | undefined;

  constructor(
    private readonly device: DeviceBase,
    private readonly devtools: Devtools,
    private readonly metro: Metro,
    private readonly disposableBuild: DisposableBuild<BuildResult>,
    private readonly debugEventDelegate: DebugSessionDelegate,
    private readonly eventDelegate: EventDelegate
  ) {
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
      case "hotReload":
        if (this.devtools.hasConnectedClient) {
          await this.metro.reload();
          return true;
        }
        return false;
      default:
        throw new Error("Not implemented " + type);
    }
  }

  private async launch() {
    if (!this.buildResult) {
      throw new Error("Expecting build to be ready");
    }
    const shouldWaitForAppLaunch = getLaunchConfiguration().preview?.waitForAppLaunch !== false;
    const waitForAppReady = shouldWaitForAppLaunch
      ? new Promise<void>((resolve) => {
          const listener = (event: string, payload: any) => {
            if (event === "RNIDE_appReady") {
              this.devtools?.removeListener(listener);
              resolve();
            }
          };
          this.devtools?.addListener(listener);
        })
      : Promise.resolve();

    this.eventDelegate.onStateChange(StartupMessage.Launching);
    await this.device.launchApp(this.buildResult, this.metro.port, this.devtools.port);

    Logger.debug("Will wait for app ready and for preview");
    this.eventDelegate.onStateChange(StartupMessage.WaitingForAppToLoad);
    await Promise.all([waitForAppReady, this.device.startPreview()]);
    Logger.debug("App and preview ready, moving on...");
    this.eventDelegate.onStateChange(StartupMessage.AttachingDebugger);
    await this.startDebugger();
  }

  public async restart() {
    return this.launch();
  }

  public async start(deviceSettings: DeviceSettings, previewReadyCallback: PreviewReadyCallback) {
    this.eventDelegate.onStateChange(StartupMessage.BootingDevice);
    await this.device.bootDevice();
    await this.device.changeSettings(deviceSettings);
    this.eventDelegate.onStateChange(StartupMessage.Building);
    this.buildResult = await this.disposableBuild.build;
    this.eventDelegate.onStateChange(StartupMessage.Installing);
    await this.device.installApp(this.buildResult, false);

    this.device.startPreview().then(() => {
      previewReadyCallback(this.device.previewURL!);
    });

    await this.launch();
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

  public get previewURL(): string | undefined {
    return this.device.previewURL;
  }

  public resumeDebugger() {
    this.debugSession?.resumeDebugger();
  }

  public stepOverDebugger() {
    this.debugSession?.stepOverDebugger();
  }

  public resetAppPermissions(permissionType: AppPermissionType) {
    if (this.buildResult) {
      return this.device.resetAppPermissions(permissionType, this.buildResult);
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
}
