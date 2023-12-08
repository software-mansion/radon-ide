import { Disposable, debug, DebugSession } from "vscode";
import { Metro } from "./metro";
import { Devtools } from "./devtools";
import { IosSimulatorDevice } from "../devices/IosSimulatorDevice";
import { AndroidEmulatorDevice } from "../devices/AndroidEmulatorDevice";
import { DeviceSettings } from "../devices/DeviceBase";
import { PreviewsPanel } from "../panels/PreviewsPanel";
import { checkXCodeBuildInstalled } from "../utilities/hostDependenciesChecks";
import fetch from "node-fetch";

const WAIT_FOR_DEBUGGER_TIMEOUT = 15000; // 15 seconds

export class DeviceSession implements Disposable {
  private device: IosSimulatorDevice | AndroidEmulatorDevice | undefined;
  private inspectCallID = 7621;
  private debugSession: DebugSession | undefined;

  constructor(
    public readonly deviceId: string,
    public readonly devtools: Devtools,
    public readonly metro: Metro
  ) {}

  public dispose() {
    this.debugSession && debug.stopDebugging(this.debugSession);
    this.device?.dispose();
  }

  async start(
    iosBuild: Promise<{ appPath: string; bundleID: string }>,
    androidBuild: Promise<{ apkPath: string; packageName: string }>,
    settings: DeviceSettings,
    systemImagePath: string
  ) {
    await checkXCodeBuildInstalled();
    const waitForAppReady = new Promise<void>((res) => {
      const listener = (event: string, payload: any) => {
        if (event === "rnp_appReady") {
          this.devtools?.removeListener(listener);
          res();
        }
      };
      this.devtools?.addListener(listener);
    });

    if (this.deviceId.startsWith("ios")) {
      this.device = new IosSimulatorDevice();
      const { appPath, bundleID } = await iosBuild;

      await this.device.bootDevice();

      await this.device.changeSettings(settings);

      await this.device.installApp(appPath);
      await this.device.launchApp(bundleID, this.metro!.port);
    } else {
      this.device = new AndroidEmulatorDevice();
      const { apkPath, packageName } = await androidBuild;
      await this.device.bootDevice(systemImagePath);
      console.log("CHECK1");
      await this.device.changeSettings(settings);
      console.log("CHECK2");
      await this.device.installApp(apkPath);
      console.log("CHECK3");
      await this.device.launchApp(packageName, this.metro!.port);
      console.log("CHECK4");
    }

    const waitForPreview = this.device.startPreview();

    await Promise.all([waitForAppReady, waitForPreview]);

    const websocketAddress = await this.waitForDebuggerURL(WAIT_FOR_DEBUGGER_TIMEOUT);
    if (websocketAddress) {
      const debugStarted = await debug.startDebugging(
        undefined,
        {
          type: "com.swmansion.react-native-preview",
          name: "React Native Preview Debugger",
          request: "attach",
          websocketAddress,
        },
        {
          suppressDebugStatusbar: true,
          suppressDebugView: true,
          suppressDebugToolbar: true,
          suppressSaveBeforeStart: true,
        }
      );
      if (debugStarted) {
        this.debugSession = debug.activeDebugSession;
      }
    } else {
      console.error("Couldn't connect to debugger");
    }

    PreviewsPanel.currentPanel?.notifyAppReady(this.deviceId, this.device.previewURL!);
  }

  private async waitForDebuggerURL(timeoutMs: number) {
    const startTime = Date.now();
    let websocketAddress: string | undefined;
    while (!websocketAddress && Date.now() - startTime < timeoutMs) {
      websocketAddress = await this.getDebuggerURL();
      await new Promise((res) => setTimeout(res, 1000));
    }
    return websocketAddress;
  }

  private async getDebuggerURL() {
    // query list from http://localhost:${metroPort}/json/list
    const list = await fetch(`http://localhost:${this.metro!.port}/json/list`);
    const listJson = await list.json();
    // with metro, pages are identified as "deviceId-pageId", we search for the most
    // recent device id and want want to use special -1 page identifier (reloadable page)
    let recentDeviceId = -1;
    let websocketAddress: string | undefined;
    for (const page of listJson) {
      // pageId can sometimes be negative so we can't just use .split('-') here
      const matches = page.id.match(/(\d+)-(-?\d+)/);
      if (matches) {
        const deviceId = parseInt(matches[1]);
        const pageId = parseInt(matches[2]);
        if (deviceId > recentDeviceId && pageId === -1) {
          recentDeviceId = deviceId;
          websocketAddress = page.webSocketDebuggerUrl;
        }
      }
    }
    return websocketAddress;
  }

  public sendTouch(xRatio: number, yRatio: number, type: "Up" | "Move" | "Down") {
    this.device?.sendTouch(xRatio, yRatio, type);
  }

  public sendKey(keyCode: number, direction: "Up" | "Down") {
    this.device?.sendKey(keyCode, direction);
  }

  public inspectElementAt(xRatio: number, yRatio: number, callback: (inspecData: any) => void) {
    const id = this.inspectCallID++;
    const listener = (event: string, payload: any) => {
      if (event === "rnp_inspectData" && payload.id === id) {
        this.devtools?.removeListener(listener);
        callback(payload);
      }
    };
    this.devtools?.addListener(listener);
    this.devtools.send("rnp_inspect", { x: xRatio, y: yRatio, id });
  }

  public openUrl(url: string) {
    this.devtools.send("rnp_runApplication", { appKey: url });
  }

  public startPreview(appKey: string) {
    this.devtools.send("rnp_runApplication", { appKey });
  }

  public onActiveFileChange(filename: string, followEnabled: boolean) {
    this.devtools.send("rnp_editorFileChanged", { filename, followEnabled });
  }

  public async changeDeviceSettings(deviceId: string, settings: DeviceSettings) {
    await this.device?.changeSettings(settings);
  }
}
