import { Disposable, debug, DebugSession, ExtensionContext } from "vscode";
import { Metro } from "./metro";
import { Devtools } from "./devtools";
import { IosSimulatorDevice } from "../devices/IosSimulatorDevice";
import { AndroidEmulatorDevice } from "../devices/AndroidEmulatorDevice";
import { DeviceSettings } from "../devices/DeviceBase";
import { PreviewsPanel } from "../panels/PreviewsPanel";
import fetch from "node-fetch";
import { Logger } from "../Logger";
import {
  ANDROID_FAIL_ERROR_MESSAGE,
  IOS_FAIL_ERROR_MESSAGE,
  isDeviceIOS,
} from "../utilities/common";
import { DeviceInfo, PLATFORM } from "../utilities/device";
import { WorkspaceStateManager } from "../panels/WorkspaceStateManager";

const WAIT_FOR_DEBUGGER_TIMEOUT = 15000; // 15 seconds

export class DeviceSession implements Disposable {
  private deviceSimulator: IosSimulatorDevice | AndroidEmulatorDevice | undefined;
  private inspectCallID = 7621;
  private debugSession: DebugSession | undefined;

  constructor(
    private context: ExtensionContext,
    public readonly device: DeviceInfo,
    public readonly devtools: Devtools,
    public readonly metro: Metro
  ) {}

  public dispose() {
    this.debugSession && debug.stopDebugging(this.debugSession);
    this.deviceSimulator?.dispose();
  }

  async start(
    iosBuild: Promise<{ appPath: string; bundleID: string }>,
    androidBuild: Promise<{ apkPath: string; packageName: string }>,
    settings: DeviceSettings,
    workspaceStateManager: WorkspaceStateManager
  ) {
    const waitForAppReady = new Promise<void>((res) => {
      const listener = (event: string, payload: any) => {
        if (event === "rnp_appReady") {
          this.devtools?.removeListener(listener);
          res();
        }
      };
      this.devtools?.addListener(listener);
    });

    if (this.device.platform === PLATFORM.IOS) {
      this.deviceSimulator = new IosSimulatorDevice(this.context);
      const { appPath, bundleID } = await iosBuild;
      const deviceUdid = await this.deviceSimulator.bootDevice(
        this.device.runtime,
        this.device.udid
      );
      if (!this.device.udid) {
        workspaceStateManager.updateDevice({ ...this.device, udid: deviceUdid });
      }
      await this.deviceSimulator.changeSettings(settings);
      await this.deviceSimulator.installApp(appPath);
      await this.deviceSimulator.launchApp(bundleID, this.metro!.port);
    } else {
      this.deviceSimulator = new AndroidEmulatorDevice(this.context);
      const { apkPath, packageName } = await androidBuild;
      const newAvdName = await this.deviceSimulator.bootDevice(
        this.device.systemImage,
        this.device.avdName
      );
      if (!this.device.avdName) {
        workspaceStateManager.updateDevice({ ...this.device, avdName: newAvdName });
      }
      await this.deviceSimulator.changeSettings(settings);
      await this.deviceSimulator.installApp(apkPath);
      await this.deviceSimulator.launchApp(packageName, this.metro!.port);
    }

    const waitForPreview = this.deviceSimulator.startPreview();
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
      Logger.error("Couldn't connect to debugger");
    }

    PreviewsPanel.currentPanel?.notifyAppReady(this.device.id, this.deviceSimulator.previewURL!);
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
          // In RN 73 metro has a bug where websocket URL returns 0 as port number when starting with port number set as 0 (ephemeral port)
          // we want to replace it with the actual port number from metro:
          // parse websocket URL:
          const websocketDebuggerUrl = new URL(page.webSocketDebuggerUrl);
          // replace port number with metro port number:
          if (websocketDebuggerUrl.port === "0") {
            websocketDebuggerUrl.port = this.metro!.port.toString();
          }
          websocketAddress = websocketDebuggerUrl.toString();
        }
      }
    }

    return websocketAddress;
  }

  public sendTouch(xRatio: number, yRatio: number, type: "Up" | "Move" | "Down") {
    this.deviceSimulator?.sendTouch(xRatio, yRatio, type);
  }

  public sendKey(keyCode: number, direction: "Up" | "Down") {
    this.deviceSimulator?.sendKey(keyCode, direction);
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

  public openNavigation(id: string) {
    this.devtools.send("rnp_openNavigation", { id });
  }

  public startPreview(previewId: string) {
    this.devtools.send("rnp_openPreview", { previewId });
  }

  public onActiveFileChange(filename: string, followEnabled: boolean) {
    this.devtools.send("rnp_editorFileChanged", { filename, followEnabled });
  }

  public async changeDeviceSettings(settings: DeviceSettings) {
    await this.deviceSimulator?.changeSettings(settings);
  }
}
