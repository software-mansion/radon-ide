import { Disposable, debug, commands } from "vscode";
import { Metro, MetroDelegate } from "./metro";
import { Devtools } from "./devtools";
import { DeviceSession } from "./deviceSession";
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
import { extensionContext } from "../utilities/extensionContext";

const LAST_SELECTED_DEVICE_KEY = "lastSelectedDevice";

export class Project implements Disposable, MetroDelegate, ProjectInterface {
  public static currentProject: Project | undefined;

  private metro: Metro;
  private devtools: Devtools;
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
    this.devtools = new Devtools();
    this.metro = new Metro(this.devtools, this);
    this.start(false, false);
    this.trySelectingInitialDevice();
  }
  onBundleError(message: string): void {
    this.updateProjectState({ status: "buildError" });
  }

  /**
   * This method tried to select the last selected device from devices list.
   * If the device list is empty, we wait until we can select a device.
   */
  private async trySelectingInitialDevice() {
    const selectInitialDevice = (devices: DeviceInfo[]) => {
      const lastDeviceId = extensionContext.workspaceState.get(LAST_SELECTED_DEVICE_KEY) as
        | string
        | undefined;
      let device = devices.find((device) => device.id === lastDeviceId);
      if (!device && devices.length > 0) {
        device = devices[0];
      }
      if (device) {
        this.selectDevice(device);
        return true;
      }
      return false;
    };

    const devices = await this.deviceManager.listAllDevices();
    if (!selectInitialDevice(devices)) {
      const listener = (devices: DeviceInfo[]) => {
        if (selectInitialDevice(devices)) {
          this.deviceManager.removeListener("devicesChanged", listener);
        }
      };
      this.deviceManager.addListener("devicesChanged", listener);
    }
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

  private reloadingMetro = false;

  public reloadMetro() {
    this.reloadingMetro = true;
    this.metro?.reload();
  }

  public async restart(forceCleanBuild: boolean) {
    this.updateProjectState({ status: "starting" });
    if (forceCleanBuild) {
      await this.start(true, forceCleanBuild);
      await this.selectDevice(this.projectState.selectedDevice!);
      return;
    }

    // if we have an active device session, we try reloading metro
    if (this.deviceSession?.isActive) {
      this.reloadMetro();
      return;
    }

    // otherwise we trigger selectDevice which should handle restarting the device, installing
    // app and launching it
    await this.selectDevice(this.projectState.selectedDevice!);
  }

  private async start(restart: boolean, forceCleanBuild: boolean) {
    if (restart) {
      const oldDevtools = this.devtools;
      const oldMetro = this.metro;
      this.devtools = new Devtools();
      this.metro = new Metro(this.devtools, this);
      oldDevtools.dispose();
      oldMetro.dispose();
    }
    Logger.debug("Launching builds");
    this.buildManager.startBuilding(forceCleanBuild);

    this.devtools.addListener((event, payload) => {
      switch (event) {
        case "rnp_appReady":
          Logger.debug("App ready");
          if (this.reloadingMetro) {
            this.reloadingMetro = false;
            this.updateProjectState({ status: "running" });
          }
          break;
        case "rnp_navigationChanged":
          this.eventEmitter.emit("navigationChanged", {
            displayName: payload.displayName,
            id: payload.id,
          });
          break;
      }
    });
    Logger.debug(`Launching devtools`);
    const waitForDevtools = this.devtools.start();

    this.debugSessionListener?.dispose();
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
          commands.executeCommand("workbench.view.debug");
          break;
        case "rnp_continued":
          this.updateProjectState({ status: "running" });
          break;
      }
    });

    Logger.debug(`Launching metro`);
    const waitForMetro = this.metro.start(forceCleanBuild);
    await Promise.all([waitForDevtools, waitForMetro]);
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

  public async openNavigation(navigationItemID: string) {
    this.deviceSession?.openNavigation(navigationItemID);
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
    extensionContext.workspaceState.update(LAST_SELECTED_DEVICE_KEY, deviceInfo.id);

    this.reloadingMetro = false;
    this.deviceSession?.dispose();
    this.deviceSession = undefined;

    this.updateProjectState({
      selectedDevice: deviceInfo,
      status: "starting",
      previewURL: undefined,
    });

    try {
      const device = await this.deviceManager.getDevice(deviceInfo);
      Logger.debug("Selected device is ready");
      // wait for metro/devtools to start before we continue
      await Promise.all([this.metro.start(false), this.devtools.start()]);
      Logger.debug("Metro & devtools ready");
      const newDeviceSession = new DeviceSession(
        device,
        this.devtools,
        this.metro,
        this.buildManager.getBuild(deviceInfo.platform)
      );
      this.deviceSession = newDeviceSession;

      await newDeviceSession.start(this.deviceSettings);
      Logger.debug("Device session started");

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
      Logger.error("Couldn't start device session", e);
      if (this.projectState.selectedDevice === deviceInfo) {
        this.updateProjectState({
          status: "buildError",
        });
      }
    }
  }
}
