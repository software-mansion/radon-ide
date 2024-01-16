import { DeviceInfo } from "./DeviceManager";

export type DeviceSettings = {
  appearance: "light" | "dark";
  contentSize: "xsmall" | "small" | "normal" | "large" | "xlarge" | "xxlarge" | "xxxlarge";
};

export type ProjectState = {
  status: "starting" | "running" | "buildError" | "runtimeError" | "debuggerPaused";
  previewURL: string | undefined;
  selectedDevice: DeviceInfo | undefined;
};

export type InspectData = {
  frame: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
};

export interface ProjectEventMap {
  log: { type: string };
  projectStateChanged: ProjectState;
  deviceSettingsChanged: DeviceSettings;
}

export interface ProjectEventListener<T> {
  (event: T): void;
}

export interface ProjectInterface {
  getProjectState(): Promise<ProjectState>;
  start(forceCleanBuild: boolean): Promise<void>;
  selectDevice(deviceInfo: DeviceInfo): Promise<void>;

  getDeviceSettings(): Promise<DeviceSettings>;
  updateDeviceSettings(deviceSettings: DeviceSettings): Promise<void>;

  resumeDebugger(): Promise<void>;

  dispatchTouch(xRatio: number, yRatio: number, type: "Up" | "Move" | "Down"): Promise<void>;
  dispatchKeyPress(keyCode: number, direction: "Up" | "Down"): Promise<void>;
  inspectElementAt(
    xRatio: number,
    yRatio: number,
    openComponentSource: boolean,
    callback: (inspectData: InspectData) => void
  ): Promise<void>;

  addListener<K extends keyof ProjectEventMap>(
    eventType: K,
    listener: ProjectEventListener<ProjectEventMap[K]>
  ): Promise<void>;
  removeListener<K extends keyof ProjectEventMap>(
    eventType: K,
    listener: ProjectEventListener<ProjectEventMap[K]>
  ): Promise<void>;
}
