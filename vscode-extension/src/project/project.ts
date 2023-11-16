import { Disposable, workspace, ExtensionContext, debug } from "vscode";
import { Metro } from "./metro";
import { Devtools } from "./devtools";
import { DeviceSession } from "./deviceSession";
import { buildIos } from "../builders/buildIOS";
import { buildAndroid } from "../builders/buildAndroid";
import { DeviceSettings } from "../devices/DeviceBase";
import crypto from "crypto";

export interface EventMonitor {
  onLogReceived: (message: { type: string }) => void;
  onDebuggerPaused: () => void;
  onDebuggerContinued: () => void;
  onUncaughtException: (isFatal: boolean) => void;
}

export class Project implements Disposable {
  public static currentProject: Project | undefined;

  private readonly context: ExtensionContext;
  private metro: Metro | undefined;
  private devtools: Devtools | undefined;
  private iOSBuild: Promise<{ appPath: string; bundleID: string }> | undefined;
  private androidBuild: Promise<{ apkPath: string; packageName: string }> | undefined;

  private session: DeviceSession | undefined;
  private eventMonitors: Array<EventMonitor> = [];

  constructor(context: ExtensionContext) {
    Project.currentProject = this;
    this.context = context;
  }

  public addEventMonitor(monitor: EventMonitor) {
    this.eventMonitors.push(monitor);
  }

  public dispose() {
    this.session?.dispose();
  }

  public reloadMetro() {
    this.metro?.reload();
  }

  public async start() {
    let workspaceDir = workspace.workspaceFolders?.[0]?.uri?.fsPath;
    if (!workspaceDir) {
      console.warn("No workspace directory found");
      return;
    }

    const metroPort = portHash(`metro://workspaceDir`); // TODO: use workspace directory here
    const devtoolsPort = portHash(`devtools://workspaceDir`);
    console.log("Ports metro:", metroPort, "devtools:", devtoolsPort, { a: 100 });
    this.metro = new Metro(workspaceDir, this.context.extensionPath, metroPort, devtoolsPort);
    this.devtools = new Devtools({ port: devtoolsPort });

    console.log("Launching builds");
    this.iOSBuild = buildIos(workspaceDir, metroPort);
    this.androidBuild = buildAndroid(workspaceDir, metroPort);

    debug.onDidReceiveDebugSessionCustomEvent((event) => {
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

    console.log("Launching metro on port", metroPort);
    await this.metro.start();
    console.log("Metro started");
  }

  public sendTouch(deviceId: string, xRatio: number, yRatio: number, type: "Up" | "Move" | "Down") {
    // TODO: verify deviceID with activeDevice
    // if (this.session?.deviceId === deviceId) {
    this.session?.sendTouch(xRatio, yRatio, type);
    // }
  }

  public inspectElementAt(xRatio: number, yRatio: number, callback: (inspectData: any) => void) {
    this.session?.inspectElementAt(xRatio, yRatio, callback);
  }

  public openUrl(url: string) {
    this.session?.openUrl(url);
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

  public async selectDevice(deviceId: string, settings: DeviceSettings) {
    console.log("Device selected", deviceId);
    this.session?.dispose();
    this.session = new DeviceSession(deviceId, this.devtools!, this.metro!);
    await this.session.start(this.iOSBuild!, this.androidBuild!, settings);
  }
}

function portHash(name: string) {
  const hash = crypto.createHash("sha256");
  hash.update(name);
  const hashBytes = hash.digest();

  // Convert hash bytes to BigInt
  const hashNumber = BigInt(`0x${hashBytes.toString("hex")}`);
  return 45000 + Number(hashNumber % BigInt(4000));
}
