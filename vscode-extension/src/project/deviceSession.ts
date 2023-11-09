import { Disposable, window, workspace, ViewColumn, Range, debug, extensions } from "vscode";
import { Metro } from "./metro";
import { Devtools } from "./devtools";
import { IosSimulatorDevice } from "../devices/IosSimulatorDevice";
import { AndroidEmulatorDevice } from "../devices/AndroidEmulatorDevice";
import { DeviceSettings } from "../devices/DeviceBase";
import path from "path";
import { PreviewsPanel } from "../panels/PreviewsPanel";

export class DeviceSession implements Disposable {
  private device: IosSimulatorDevice | AndroidEmulatorDevice | undefined;
  private inspecting = false;
  private inspectingDownSent = false;

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

  public startInspecting() {
    this.inspecting = true;
    this.inspectingDownSent = false;
    this.devtools.send("startInspectingNative");
  }

  public stopInspecting() {
    this.inspecting = false;
    this.devtools.send("stopInspectingNative");
  }

  public inspectElementAt(xRatio: number, yRatio: number) {
    if (!this.inspecting) {
      return;
    }
    const listener = (event: string, payload: any) => {
      if (event === "selectFiber") {
        const id: number = payload;
        console.log("Inspect eleemnt", id);
        this.devtools?.send("inspectElement", {
          id,
          rendererID: 1,
          forceFullData: true,
          requestID: 77,
          path: null,
        });
      } else if (event === "inspectedElement") {
        try {
          console.log("PL", payload);
          const { fileName, lineNumber, columnNumber } = payload.value.source;
          if (isFileInWorkspace(workspace.workspaceFolders?.[0]?.uri?.fsPath || "", fileName)) {
            openFileAtPosition(fileName, lineNumber - 1, columnNumber - 1);
            this.devtools?.removeListener(listener);
            return;
          }
        } catch (e) {
          console.log("Err", e);
        }
        if (payload.value.owners.length > 0) {
          console.log("Inspect", payload.value.owners[0].id);
          this.devtools?.send("inspectElement", {
            id: payload.value.owners[0].id,
            rendererID: 1,
            forceFullData: true,
            requestID: 77,
            path: null,
          });
        }
      }
    };
    this.devtools?.addListener(listener);
    // simulate click on specific location, we assume inspecting has been started
    this.device?.sendTouch(xRatio, yRatio, this.inspectingDownSent ? "Move" : "Down");
    this.inspectingDownSent = true;
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

async function openFileAtPosition(filePath: string, line: number, column: number) {
  const existingDocument = workspace.textDocuments.find((document) => {
    console.log("Existing document list", document.uri.fsPath);
    return document.uri.fsPath === filePath;
  });

  if (existingDocument) {
    // If the file is already open, show (focus on) its editor
    await window.showTextDocument(existingDocument, {
      selection: new Range(line, column, line, column),
      viewColumn: ViewColumn.One,
    });
  } else {
    // If the file is not open, open it in a new editor
    const document = await workspace.openTextDocument(filePath);
    await window.showTextDocument(document, {
      selection: new Range(line, column, line, column),
      viewColumn: ViewColumn.One,
    });
  }
}

function isFileInWorkspace(workspaceDir: string, filePath: string): boolean {
  // Get the relative path from the workspace directory to the file
  const relative = path.relative(workspaceDir, filePath);

  // If the relative path starts with "..", the file is outside the workspace
  return (
    !relative.startsWith("..") && !path.isAbsolute(relative) && !relative.startsWith("node_modules")
  );
}
