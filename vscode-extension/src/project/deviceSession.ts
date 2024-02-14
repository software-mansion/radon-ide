import { Disposable, debug, DebugSession } from "vscode";
import { Metro } from "./metro";
import { Devtools } from "./devtools";
import { DeviceBase } from "../devices/DeviceBase";
import { Logger } from "../Logger";
import { BuildResult, DisposableBuild } from "../builders/BuildManager";
import { DeviceSettings, StartupMessage } from "../common/Project";

const WAIT_FOR_DEBUGGER_TIMEOUT = 15000; // 15 seconds

type ProgressCallback = (startupMessage: string) => void;

export class DeviceSession implements Disposable {
  private inspectCallID = 7621;
  private debugSession: DebugSession | undefined;

  constructor(
    private readonly device: DeviceBase,
    private readonly devtools: Devtools,
    private readonly metro: Metro,
    private readonly disposableBuild: DisposableBuild<BuildResult>
  ) {}

  public dispose() {
    this.debugSession && debug.stopDebugging(this.debugSession);
    this.disposableBuild.dispose();
    this.device?.dispose();
  }

  get isActive() {
    return this.devtools.hasConnectedClient;
  }

  async start(deviceSettings: DeviceSettings, progressCallback: ProgressCallback) {
    const waitForAppReady = new Promise<void>((res) => {
      const listener = (event: string, payload: any) => {
        if (event === "rnp_appReady") {
          this.devtools?.removeListener(listener);
          res();
        }
      };
      this.devtools?.addListener(listener);
    });

    progressCallback(StartupMessage.BootingDevice);
    await this.device.bootDevice();
    await this.device.changeSettings(deviceSettings);
    progressCallback(StartupMessage.Building);
    const build = await this.disposableBuild.build;
    progressCallback(StartupMessage.Installing);
    await this.device.installApp(build, false);
    progressCallback(StartupMessage.Launching);
    await this.device.launchApp(build, this.metro.port);

    const waitForPreview = this.device.startPreview();
    Logger.debug("Will wait for app ready and for preview");
    progressCallback(StartupMessage.WaitingForAppToLoad);
    await Promise.all([waitForAppReady, waitForPreview]);
    Logger.debug("App and preview ready, moving on...");

    progressCallback(StartupMessage.AttachingDebugger);
    const websocketAddress = await this.metro.getDebuggerURL(WAIT_FOR_DEBUGGER_TIMEOUT);
    if (websocketAddress) {
      const debugStarted = await debug.startDebugging(
        undefined,
        {
          type: "com.swmansion.react-native-ide",
          name: "React Native IDE Debugger",
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
  }

  public get previewURL(): string | undefined {
    return this.device.previewURL;
  }

  public resumeDebugger() {
    this.debugSession?.customRequest("continue");
  }

  public stepOverDebugger() {
    this.debugSession?.customRequest("next");
  }

  public sendTouch(xRatio: number, yRatio: number, type: "Up" | "Move" | "Down") {
    this.device.sendTouch(xRatio, yRatio, type);
  }

  public sendKey(keyCode: number, direction: "Up" | "Down") {
    this.device.sendKey(keyCode, direction);
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
    await this.device.changeSettings(settings);
  }
}
