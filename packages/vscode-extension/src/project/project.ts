import { Disposable, debug, commands, workspace, window, LogOutputChannel } from "vscode";
import { Metro, MetroDelegate } from "./metro";
import { Devtools } from "./devtools";
import { DeviceSession } from "./deviceSession";
import { Logger } from "../Logger";
import { BuildManager } from "../builders/BuildManager";
import { DeviceManager } from "../devices/DeviceManager";
import { DeviceInfo } from "../common/DeviceManager";
import { throttle } from "../common/utils";
import {
  DeviceSettings,
  ProjectEventListener,
  ProjectEventMap,
  ProjectInterface,
  ProjectState,
  StartupMessage,
} from "../common/Project";
import { EventEmitter } from "stream";
import { openFileAtPosition } from "../utilities/openFileAtPosition";
import { extensionContext } from "../utilities/extensionContext";
import stripAnsi from "strip-ansi";

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
    this.deviceManager.addListener("deviceRemoved", this.removeDeviceListener);
  }

  onBundleError(): void {
    this.updateProjectState({ status: "bundleError" });
  }

  onIncrementalBundleError(message: string, errorModulePath: string): void {
    Logger.error(stripAnsi(message));
    // if bundle build failed, we don't want to change the status
    // incrementalBundleError status should be set only when bundleError status is not set
    if (this.projectState.status === "bundleError") {
      return;
    }
    this.updateProjectState({ status: "incrementalBundleError" });
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
      this.updateProjectState({
        selectedDevice: undefined,
      });
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
    this.deviceManager.removeListener("deviceRemoved", this.removeDeviceListener);
  }

  private reloadingMetro = false;

  public reloadMetro() {
    this.reloadingMetro = true;
    this.metro?.reload();
  }

  public async restart(forceCleanBuild: boolean) {
    this.updateProjectState({ status: "starting", startupMessage: StartupMessage.Restarting });
    if (forceCleanBuild) {
      await this.start(true, forceCleanBuild);
      await this.selectDevice(this.projectState.selectedDevice!, forceCleanBuild);
      return;
    }

    // if we have an active device session, we try reloading metro
    if (this.deviceSession?.isActive) {
      this.reloadMetro();
      return;
    }

    // otherwise we trigger selectDevice which should handle restarting the device, installing
    // app and launching it
    await this.selectDevice(this.projectState.selectedDevice!, forceCleanBuild);
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
        case "rnp_fastRefreshStarted":
          this.updateProjectState({ status: "refreshing" });
          break;
        case "rnp_fastRefreshComplete":
          if (this.projectState.status === "starting") return;
          if (this.projectState.status === "incrementalBundleError") return;
          if (this.projectState.status === "runtimeError") return;
          this.updateProjectState({ status: "running" });
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
            // if we know that incrmental bundle error happened, we don't want to change the status
            if (this.projectState.status === "incrementalBundleError") return;
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
    const waitForMetro = this.metro.start(
      forceCleanBuild,
      throttle((stageProgress: number) => {
        this.reportStageProgress(stageProgress, StartupMessage.WaitingForAppToLoad);
      }, 100)
    );
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
          if (element?.source?.fileName && isAppSourceFile(element.source.fileName)) {
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

  public async stepOverDebugger() {
    this.deviceSession?.stepOverDebugger();
  }
  public async focusBuildOutput() {
    if (!this.projectState.selectedDevice) {
      return;
    }
    this.buildManager.focusBuildOutput();
  }
  public async focusDebugConsole() {
    commands.executeCommand("workbench.panel.repl.view.focus");
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

  private reportStageProgress(stageProgress: number, stage: string) {
    if (stage !== this.projectState.startupMessage) {
      return;
    }
    this.updateProjectState({ stageProgress });
  }

  private updateProjectState(newState: Partial<ProjectState>) {
    // stageProgress is tied to a startup stage, so when there is a change of status or startupMessage,
    // we always want to reset the progress.
    if (newState.status !== undefined || newState.startupMessage !== undefined) {
      delete this.projectState.stageProgress;
    }
    this.projectState = { ...this.projectState, ...newState };
    this.eventEmitter.emit("projectStateChanged", this.projectState);
  }

  private updateProjectStateForDevice(deviceInfo: DeviceInfo, newState: Partial<ProjectState>) {
    if (deviceInfo === this.projectState.selectedDevice) {
      this.updateProjectState(newState);
    }
  }

  public async selectDevice(deviceInfo: DeviceInfo, forceCleanBuild = false) {
    Logger.log("Device selected", deviceInfo.name);
    extensionContext.workspaceState.update(LAST_SELECTED_DEVICE_KEY, deviceInfo.id);

    this.reloadingMetro = false;
    this.deviceSession?.dispose();
    this.deviceSession = undefined;

    this.updateProjectState({
      selectedDevice: deviceInfo,
      status: "starting",
      startupMessage: StartupMessage.InitializingDevice,
      previewURL: undefined,
    });

    try {
      const device = await this.deviceManager.getDevice(deviceInfo);
      Logger.debug("Selected device is ready");
      this.updateProjectStateForDevice(deviceInfo, {
        startupMessage: StartupMessage.StartingPackager,
      });
      // wait for metro/devtools to start before we continue
      await Promise.all([this.metro.ready(), this.devtools.ready()]);
      Logger.debug("Metro & devtools ready");
      const newDeviceSession = new DeviceSession(
        device,
        this.devtools,
        this.metro,
        this.buildManager.startBuild(
          deviceInfo.platform,
          forceCleanBuild,
          throttle((stageProgress: number) => {
            this.reportStageProgress(stageProgress, StartupMessage.Building);
          }, 100)
        )
      );
      this.deviceSession = newDeviceSession;

      await newDeviceSession.start(this.deviceSettings, (startupMessage) =>
        this.updateProjectStateForDevice(deviceInfo, { startupMessage })
      );
      Logger.debug("Device session started");

      const previewURL = newDeviceSession.previewURL;
      if (!previewURL) {
        throw new Error("No preview URL");
      }

      this.updateProjectStateForDevice(deviceInfo, {
        status: "running",
        previewURL,
      });
    } catch (e: any) {
      //TODO: find where can we catch this error to prevent it from leaking here (if statment below is a hotfix of issue #8)
      if (/Command was killed with SIGKILL \(Forced termination\): xcodebuild/.exec(e.message)) {
        Logger.debug(e);
        return;
      }
      Logger.error("Couldn't start device session", e);
      if (this.projectState.selectedDevice === deviceInfo) {
        this.updateProjectState({
          status: "buildError",
        });
      }
    }
  }

  private removeDeviceListener = async (devices: DeviceInfo) => {
    await this.trySelectingInitialDevice();
  };
}

export function isAppSourceFile(filePath: string) {
  const relativeToWorkspace = workspace.asRelativePath(filePath, false);

  if (relativeToWorkspace === filePath) {
    // when path is outside of any workspace folder, workspace.asRelativePath returns the original path
    return false;
  }

  // if the relative path contain node_modules, we assume it's not user's app source file:
  return !relativeToWorkspace.includes("node_modules");
}
