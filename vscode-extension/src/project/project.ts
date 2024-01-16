import { Disposable, debug } from "vscode";
import { Metro } from "./metro";
import { Devtools } from "./devtools";
import { DeviceSession } from "./deviceSession";
import { getWorkspacePath } from "../utilities/common";
import { Logger } from "../Logger";
import { BuildManager } from "../builders/BuildManager";
import { DeviceManager } from "../devices/DeviceManager";
import { DeviceInfo } from "../common/DeviceManager";
import {
  DeviceSettings,
  ProjectEventListener,
  ProjectEventMap,
  ProjectInterface,
  ProjectState,
} from "../common/Project";
import { EventEmitter } from "stream";
import { isFileInWorkspace } from "../utilities/isFileInWorkspace";
import { openFileAtPosition } from "../utilities/openFileAtPosition";

export class Project implements Disposable, ProjectInterface {
  public static currentProject: Project | undefined;

  private metro: Metro | undefined;
  private devtools: Devtools | undefined;
  private debugSessionListener: Disposable | undefined;
  private buildManager = new BuildManager();
  private eventEmitter = new EventEmitter();

  private deviceSession: DeviceSession | undefined;

  private projectState: ProjectState = {
    status: "starting",
    previewURL: undefined,
    selectedDevice: undefined,
  };

  private deviceSettings: DeviceSettings = {
    appearance: "dark",
    contentSize: "normal",
  };

  constructor(private readonly deviceManager: DeviceManager) {
    Project.currentProject = this;
  }

  async getProjectState(): Promise<ProjectState> {
    return this.projectState;
  }

  async addListener<K extends keyof ProjectEventMap>(
    eventType: K,
    listener: ProjectEventListener<ProjectEventMap[K]>
  ) {
    this.eventEmitter.addListener(eventType, listener);
  }
  async removeListener<K extends keyof ProjectEventMap>(
    eventType: K,
    listener: ProjectEventListener<ProjectEventMap[K]>
  ) {
    this.eventEmitter.removeListener(eventType, listener);
  }

  public dispose() {
    this.deviceSession?.dispose();
    this.metro?.dispose();
    this.devtools?.dispose();
    this.debugSessionListener?.dispose();
  }

  public reloadMetro() {
    this.metro?.reload();
  }

  public async start(forceCleanBuild: boolean) {
    let workspaceDir = getWorkspacePath();
    if (!workspaceDir) {
      Logger.warn("No workspace directory found");
      return;
    }

    this.devtools = new Devtools();
    await this.devtools.start();
    this.metro = new Metro(workspaceDir, this.devtools.port);

    Logger.debug("Launching builds");
    await this.buildManager.startBuilding(forceCleanBuild);

    this.debugSessionListener = debug.onDidReceiveDebugSessionCustomEvent((event) => {
      switch (event.event) {
        case "rnp_consoleLog":
          this.eventEmitter.emit("log", event.body);
          break;
        case "rnp_paused":
          if (event.body?.reason === "exception") {
            this.updateProjectState({ status: "runtimeError" });
          } else {
            this.updateProjectState({ status: "debuggerPaused" });
          }
          break;
        case "rnp_continued":
          this.updateProjectState({ status: "running" });
          break;
      }
    });

    Logger.debug(`Launching metro`);
    await this.metro.start(forceCleanBuild);
    Logger.debug(`Metro started on port ${this.metro.port} devtools on port ${this.devtools.port}`);
  }

  public async dispatchTouch(xRatio: number, yRatio: number, type: "Up" | "Move" | "Down") {
    this.deviceSession?.sendTouch(xRatio, yRatio, type);
  }

  public async dispatchKeyPress(keyCode: number, direction: "Up" | "Down") {
    this.deviceSession?.sendKey(keyCode, direction);
  }

  public async inspectElementAt(
    xRatio: number,
    yRatio: number,
    openComponentSource: boolean,
    callback: (inspectData: any) => void
  ) {
    this.deviceSession?.inspectElementAt(xRatio, yRatio, (inspectData) => {
      callback({ frame: inspectData.frame });
      if (openComponentSource) {
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
  }

  public async resumeDebugger() {
    this.deviceSession?.resumeDebugger();
  }

  public openNavigation(id: string) {
    this.deviceSession?.openNavigation(id);
  }

  public startPreview(appKey: string) {
    this.deviceSession?.startPreview(appKey);
  }

  public onActiveFileChange(filename: string, followEnabled: boolean) {
    this.deviceSession?.onActiveFileChange(filename, followEnabled);
  }

  public async getDeviceSettings() {
    return this.deviceSettings;
  }

  public async updateDeviceSettings(settings: DeviceSettings) {
    this.deviceSettings = settings;
    await this.deviceSession?.changeDeviceSettings(settings);
    this.eventEmitter.emit("deviceSettingsChanged", this.deviceSettings);
  }

  private updateProjectState(newState: Partial<ProjectState>) {
    this.projectState = { ...this.projectState, ...newState };
    this.eventEmitter.emit("projectStateChanged", this.projectState);
  }

  public async selectDevice(deviceInfo: DeviceInfo) {
    Logger.log("Device selected", deviceInfo.name);
    this.deviceSession?.dispose();
    this.deviceSession = undefined;

    this.updateProjectState({
      selectedDevice: deviceInfo,
      status: "starting",
      previewURL: undefined,
    });

    try {
      const device = await this.deviceManager.getDevice(deviceInfo);
      const newDeviceSession = new DeviceSession(
        device,
        this.devtools!,
        this.metro!,
        this.buildManager.getBuild(deviceInfo.platform)
      );
      this.deviceSession = newDeviceSession;

      await newDeviceSession.start(this.deviceSettings);

      const previewURL = newDeviceSession.previewURL;
      if (!previewURL) {
        throw new Error("No preview URL");
      }

      if (this.projectState.selectedDevice === deviceInfo) {
        this.updateProjectState({
          status: "running",
          previewURL,
        });
      }
    } catch (e) {
      if (this.projectState.selectedDevice === deviceInfo) {
        this.updateProjectState({
          status: "runtimeError",
        });
      }
    }
  }
}
