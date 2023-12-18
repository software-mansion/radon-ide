import { Disposable, workspace, ExtensionContext, debug } from "vscode";
import { Metro } from "./metro";
import { Devtools } from "./devtools";
import { DeviceSession } from "./deviceSession";
import { buildIos } from "../builders/buildIOS";
import { buildAndroid } from "../builders/buildAndroid";
import { DeviceSettings } from "../devices/DeviceBase";
import { getWorkspacePath } from "../utilities/common";
import { Logger } from "../Logger";
import { BuildManager } from "../builders/BuildManager";

export interface EventMonitor {
  onLogReceived: (message: { type: string }) => void;
  onDebuggerPaused: () => void;
  onDebuggerContinued: () => void;
  onUncaughtException: (isFatal: boolean) => void;
}

export class Project implements Disposable {
  public static currentProject: Project | undefined;

  private metro: Metro | undefined;
  private devtools: Devtools | undefined;
  private debugSessionListener: Disposable | undefined;
  private buildManager: BuildManager | undefined;

  private session: DeviceSession | undefined;
  private eventMonitors: Array<EventMonitor> = [];

  constructor(private readonly context: ExtensionContext) {
    Project.currentProject = this;
  }

  public addEventMonitor(monitor: EventMonitor) {
    this.eventMonitors.push(monitor);
  }

  public dispose() {
    this.session?.dispose();
    this.metro?.dispose();
    this.devtools?.dispose();
    this.debugSessionListener?.dispose();
    this.eventMonitors = [];
  }

  public reloadMetro() {
    this.metro?.reload();
  }

  public switchBuildCaching(enabled: boolean) {
    this.buildManager?.setCheckCache(enabled);
  }

  public async start() {
    let workspaceDir = getWorkspacePath();
    if (!workspaceDir) {
      Logger.warn("No workspace directory found");
      return;
    }

    if (!this.buildManager) {
      this.buildManager = new BuildManager(workspaceDir);
    }

    this.devtools = new Devtools();
    await this.devtools.start();
    this.metro = new Metro(workspaceDir, this.context.extensionPath, this.devtools.port);

    Logger.log("Launching builds");

    await this.buildManager.startBuilding();

    this.debugSessionListener = debug.onDidReceiveDebugSessionCustomEvent((event) => {
      switch (event.event) {
        case "rnp_consoleLog":
          this.eventMonitors.forEach((monitor) => monitor.onLogReceived(event.body));
          break;
        case "rnp_paused":
          this.eventMonitors.forEach((monitor) => {
            if (event.body?.reason === "exception") {
              monitor.onUncaughtException(event.body.isFatal);
            } else {
              monitor.onDebuggerPaused();
            }
          });
          break;
        case "rnp_continued":
          this.eventMonitors.forEach((monitor) => monitor.onDebuggerContinued());
          break;
      }
    });

    Logger.log(`Launching metro`);
    await this.metro.start();
    Logger.log(`Metro started on port ${this.metro.port} devtools on port ${this.devtools.port}`);
  }

  public sendTouch(deviceId: string, xRatio: number, yRatio: number, type: "Up" | "Move" | "Down") {
    // TODO: verify deviceID with activeDevice
    // if (this.session?.deviceId === deviceId) {
    this.session?.sendTouch(xRatio, yRatio, type);
    // }
  }

  public sendKey(deviceId: string, keyCode: number, direction: "Up" | "Down") {
    this.session?.sendKey(keyCode, direction);
  }

  public inspectElementAt(xRatio: number, yRatio: number, callback: (inspectData: any) => void) {
    this.session?.inspectElementAt(xRatio, yRatio, callback);
  }

  public openNavigation(id: string) {
    this.session?.openNavigation(id);
  }

  public startPreview(appKey: string) {
    this.session?.startPreview(appKey);
  }

  public onActiveFileChange(filename: string, followEnabled: boolean) {
    this.session?.onActiveFileChange(filename, followEnabled);
  }

  public async changeDeviceSettings(deviceId: string, settings: DeviceSettings) {
    await this.session?.changeDeviceSettings(deviceId, settings);
  }

  public async selectDevice(deviceId: string, settings: DeviceSettings, systemImagePath: string) {
    Logger.log(`Device selected ${deviceId}, with system image Path: ${systemImagePath}`);
    this.session?.dispose();
    this.session = new DeviceSession(this.context, deviceId, this.devtools!, this.metro!);
    await this.session.start(
      this.buildManager?.getIosBuild()!,
      this.buildManager?.getAndroidBuild()!,
      settings,
      systemImagePath
    );
  }
}
