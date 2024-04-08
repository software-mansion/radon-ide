import { DeviceInfo } from "./DeviceManager";

export type DeviceSettings = {
  appearance: "light" | "dark";
  contentSize: "xsmall" | "small" | "normal" | "large" | "xlarge" | "xxlarge" | "xxxlarge";
};

export type ProjectState = {
  status:
    | "starting"
    | "running"
    | "buildError"
    | "runtimeError"
    | "bundleError"
    | "incrementalBundleError"
    | "debuggerPaused"
    | "refreshing";
  startupMessage?: string; // Only used when status is "starting"
  stageProgress?: number;
  previewURL: string | undefined;
  selectedDevice: DeviceInfo | undefined;
};

// important: order of values in this enum matters
export enum StartupMessage {
  InitializingDevice = "Initializing device",
  StartingPackager = "Starting packager",
  BootingDevice = "Booting device",
  Building = "Building",
  Installing = "Installing",
  Launching = "Launching",
  WaitingForAppToLoad = "Waiting for app to load",
  AttachingDebugger = "Attaching debugger",
  Restarting = "Restarting",
}

export const StartupStageWeight = [
  { startupMessage: StartupMessage.InitializingDevice, weight: 1 },
  { startupMessage: StartupMessage.StartingPackager, weight: 1 },
  { startupMessage: StartupMessage.BootingDevice, weight: 2 },
  { startupMessage: StartupMessage.Building, weight: 7 },
  { startupMessage: StartupMessage.Installing, weight: 1 },
  { startupMessage: StartupMessage.Launching, weight: 1 },
  { startupMessage: StartupMessage.WaitingForAppToLoad, weight: 6 },
  { startupMessage: StartupMessage.AttachingDebugger, weight: 1 },
];

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
  selectDevice(deviceInfo: DeviceInfo): Promise<void>;

  getDeviceSettings(): Promise<DeviceSettings>;
  updateDeviceSettings(deviceSettings: DeviceSettings): Promise<void>;

  resumeDebugger(): Promise<void>;
  stepOverDebugger(): Promise<void>;
  focusBuildOutput(): Promise<void>;
  focusExtensionLogsOutput(): Promise<void>;
  focusDebugConsole(): Promise<void>;
  openNavigation(navigationItemID: string): Promise<void>;
  openDevMenu(): Promise<void>;

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
