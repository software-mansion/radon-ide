import { DeviceInfo } from "./DeviceManager";

export type DeviceSettings = {
  appearance: "light" | "dark";
  contentSize: "xsmall" | "small" | "normal" | "large" | "xlarge" | "xxlarge" | "xxxlarge";
};

export type ProjectState = {
  status: "starting" | "running" | "buildError" | "runtimeError" | "debuggerPaused" | "refreshing";
  startupMessage?: string; // Only used when status is "starting"
  previewURL: string | undefined;
  selectedDevice: DeviceInfo | undefined;
};

// important: order of values in this enum matters
export enum StartupMessage {
  StartingPackager = "Starting packager",
  InitializingDevice = "Initializing device",
  BootingDevice = "Booting device",
  Building = "Building",
  Installing = "Installing",
  Launching = "Launching",
  WaitingForAppToLoad = "Waiting for app to load",
  AttachingDebugger = "Attaching debugger",
  Restarting = "Restarting",
}

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
  navigationChanged: { displayName: string; id: string };
}

export interface ProjectEventListener<T> {
  (event: T): void;
}

export interface ProjectInterface {
  getProjectState(): Promise<ProjectState>;
  restart(forceCleanBuild: boolean): Promise<void>;
  reloadWebview(): Promise<void>;
  selectDevice(deviceInfo: DeviceInfo): Promise<void>;

  getDeviceSettings(): Promise<DeviceSettings>;
  updateDeviceSettings(deviceSettings: DeviceSettings): Promise<void>;

  resumeDebugger(): Promise<void>;
  stepOverDebugger(): Promise<void>;

  openNavigation(navigationItemID: string): Promise<void>;

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
