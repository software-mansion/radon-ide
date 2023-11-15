import { Disposable, debug } from "vscode";
import { Metro } from "./metro";
import { Devtools } from "./devtools";
import { IosSimulatorDevice } from "../devices/IosSimulatorDevice";
import { AndroidEmulatorDevice } from "../devices/AndroidEmulatorDevice";
import { DeviceSettings } from "../devices/DeviceBase";
import { PreviewsPanel } from "../panels/PreviewsPanel";

export class DeviceSession implements Disposable {
  private device: IosSimulatorDevice | AndroidEmulatorDevice | undefined;
  private inspectCallID = 7621;

  constructor(
    public readonly deviceId: string,
    public readonly devtools: Devtools,
    public readonly metro: Metro
  ) {}

  public dispose() {
    this.device?.dispose();
  }

  async start(
    iosBuild: Promise<{ appPath: string; bundleID: string }>,
    androidBuild: Promise<{ apkPath: string; packageName: string }>,
    settings: DeviceSettings
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

    if (this.deviceId.startsWith("ios")) {
      this.device = new IosSimulatorDevice();
      const { appPath, bundleID } = await iosBuild;
      await this.device.bootDevice();
      await this.device.changeSettings(settings);
      await this.device.installApp(appPath);
      await this.device.launchApp(bundleID);
    } else {
      this.device = new AndroidEmulatorDevice();
      const { apkPath, packageName } = await androidBuild;
      await this.device.bootDevice();
      await this.device.changeSettings(settings);
      await this.device.installApp(apkPath);
      await this.device.launchApp(packageName, this.metro!.port, this.devtools!.port);
    }

    const waitForPreview = this.device.startPreview();

    await Promise.all([waitForAppReady, waitForPreview]);

    PreviewsPanel.currentPanel?.notifyAppReady(this.deviceId, this.device.previewURL!);

    await debug.startDebugging(
      undefined,
      {
        type: "com.swmansion.react-native-preview",
        name: "React Native Preview Debugger",
        request: "attach",
        metroPort: this.metro!.port,
      },
      {
        suppressDebugStatusbar: true,
        suppressDebugView: true,
        suppressDebugToolbar: true,
        suppressSaveBeforeStart: true,
      }
    );
  }

  public sendTouch(xRatio: number, yRatio: number, type: "Up" | "Move" | "Down") {
    this.device?.sendTouch(xRatio, yRatio, type);
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
