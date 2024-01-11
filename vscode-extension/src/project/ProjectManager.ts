import { ExtensionContext, Webview, Disposable } from "vscode";
import { Logger } from "../Logger";
import { Project } from "./project";
import { isFileInWorkspace } from "../utilities/isFileInWorkspace";
import { openFileAtPosition } from "../utilities/openFileAtPosition";
import { DeviceInfo } from "../utilities/device";
import { DeviceSettings } from "../devices/DeviceBase";
import { WorkspaceStateManager } from "../panels/WorkspaceStateManager";
import { ANDROID_FAIL_ERROR_MESSAGE, IOS_FAIL_ERROR_MESSAGE } from "../utilities/common";

const PROJECT_MANAGER_COMMANDS = [
  "startProject",
  "changeDevice",
  "changeDeviceSettings",
  "touch",
  "key",
  "inspect",
  "restartProject",
  "openNavigation",
];

export class ProjectManager {
  private project: Project;
  private projectStarted = false;
  private disposables: Disposable[] = [];

  constructor(
    private readonly webview: Webview,
    private readonly workspaceStateManager: WorkspaceStateManager,
    private readonly context: ExtensionContext
  ) {
    this.project = new Project(context);
  }

  public onActiveFileChange(filename: string, followEnabled: boolean) {
    this.project.onActiveFileChange(filename, followEnabled);
  }

  public startPreview(appKey: string) {
    this.project.startPreview(appKey);
  }

  public startListening() {
    this.webview.onDidReceiveMessage((message: any) => {
      const command = message.command;

      if (!PROJECT_MANAGER_COMMANDS.includes(command)) {
        return;
      }

      Logger.log(`Project Manager received a message with command ${command}.`);

      switch (command) {
        case "startProject":
          this.startProject(message.device, message.settings, !!message.forceCleanBuild);
          return;
        case "changeDevice":
          this.handleSelectDevice(message.device, message.settings);
          return;
        case "changeDeviceSettings":
          this.project.changeDeviceSettings(message.settings);
          return;
        case "touch":
          this.project.sendTouch(message.deviceId, message.xRatio, message.yRatio, message.type);
          return;
        case "key":
          this.project.sendKey(message.deviceId, message.keyCode, message.type);
          return;
        case "inspect":
          this.project.inspectElementAt(message.xRatio, message.yRatio, (inspectData) => {
            this.webview.postMessage({
              command: "inspectData",
              data: inspectData,
            });
            if (message.type === "Down") {
              // find last element in inspectData.hierarchy with source that belongs to the workspace
              for (let i = inspectData.hierarchy.length - 1; i >= 0; i--) {
                const element = inspectData.hierarchy[i];
                if (isFileInWorkspace(element.source.fileName)) {
                  openFileAtPosition(
                    element.source.fileName,
                    element.source.lineNumber - 1,
                    element.source.columnNumber - 1
                  );
                  break;
                }
              }
            }
          });
          return;
        case "restartProject":
          this.resetProject(message.device, message.settings);
          return;
        case "openNavigation":
          this.project.openNavigation(message.id);
          return;
      }
    });
  }

  private async startProject(
    device: DeviceInfo,
    settings: DeviceSettings,
    forceCleanBuild: boolean
  ) {
    // in dev mode, react may trigger this message twice as it comes from useEffect
    // we need to make sure we don't start the project twice
    if (this.projectStarted) {
      return;
    }
    this.projectStarted = true;
    await this.project.start(this.workspaceStateManager, forceCleanBuild);
    this.project.addEventMonitor({
      onLogReceived: (message) => {
        this.webview.postMessage({
          command: "logEvent",
          type: message.type,
        });
      },
      onDebuggerPaused: () => {
        this.webview.postMessage({
          command: "debuggerPaused",
        });
      },
      onDebuggerContinued: () => {
        this.webview.postMessage({
          command: "debuggerContinued",
        });
      },
      onUncaughtException: (isFatal) => {
        this.webview.postMessage({
          command: "uncaughtException",
          isFatal: isFatal,
        });
      },
    });
    this.disposables.push(this.project);

    this.handleSelectDevice(device, settings);
  }

  private async handleSelectDevice(device: DeviceInfo, settings: DeviceSettings) {
    try {
      await this.project.selectDevice(device, settings, this.workspaceStateManager);
    } catch (error) {
      const isStringError = typeof error === "string";
      this.webview.postMessage({
        command: "projectError",
        androidBuildFailed: isStringError && error.startsWith(ANDROID_FAIL_ERROR_MESSAGE),
        iosBuildFailed: isStringError && error.startsWith(IOS_FAIL_ERROR_MESSAGE),
        error,
      });
      throw error;
    }
  }

  private async resetProject(device: DeviceInfo, settings: DeviceSettings) {
    this.project.dispose();
    this.projectStarted = false;
    this.project = new Project(this.context);
    this.startProject(device, settings, true);
  }
}
