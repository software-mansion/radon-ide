import { DeviceInfo } from "./DeviceManager";

export type Locale = string;

export type DeviceSettings = {
  appearance: "light" | "dark";
  contentSize: "xsmall" | "small" | "normal" | "large" | "xlarge" | "xxlarge" | "xxxlarge";
  location: {
    latitude: number;
    longitude: number;
    isDisabled: boolean;
  };
  hasEnrolledBiometrics: boolean;
  locale: Locale;
  replaysEnabled: boolean;
  showTouches: boolean;
};

export type ToolsState = {
  [key: string]: { enabled: boolean; panelAvailable: boolean; label: string };
};

export type ProjectState = {
  status:
    | "starting"
    | "running"
    | "buildError"
    | "bootError"
    | "runtimeError"
    | "bundleError"
    | "incrementalBundleError"
    | "debuggerPaused"
    | "refreshing";
  startupMessage?: string; // Only used when status is "starting"
  stageProgress?: number;
  previewURL: string | undefined;
  selectedDevice: DeviceInfo | undefined;
  initialized: boolean;
  previewZoom: ZoomLevelType | undefined; // Preview specific. Consider extracting to different location if we store more preview state
};

export type ZoomLevelType = number | "Fit";

export type AppPermissionType = "all" | "location" | "photos" | "contacts" | "calendar";

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
  { StartupMessage: StartupMessage.InitializingDevice, weight: 1 },
  { StartupMessage: StartupMessage.StartingPackager, weight: 1 },
  { StartupMessage: StartupMessage.BootingDevice, weight: 2 },
  { StartupMessage: StartupMessage.Building, weight: 7 },
  { StartupMessage: StartupMessage.Installing, weight: 1 },
  { StartupMessage: StartupMessage.Launching, weight: 1 },
  { StartupMessage: StartupMessage.WaitingForAppToLoad, weight: 6 },
  { StartupMessage: StartupMessage.AttachingDebugger, weight: 1 },
];

export type ReloadAction =
  | "rebuild" // clean build, boot device, install app
  | "reboot" // reboots device, launch app
  | "reinstall" // force reinstall app
  | "restartProcess" // relaunch app
  | "reloadJs"; // refetch JS scripts from metro

export type Frame = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type InspectDataStackItem = {
  componentName: string;
  hide: boolean;
  source: {
    fileName: string;
    line0Based: number;
    column0Based: number;
  };
  frame: Frame;
};

export type InspectStackData = {
  requestLocation: { x: number; y: number };
  stack: InspectDataStackItem[];
};

export type InspectData = {
  stack: InspectDataStackItem[] | undefined;
  frame: Frame;
};

export type TouchPoint = {
  xRatio: number;
  yRatio: number;
};

export enum ActivateDeviceResult {
  succeeded,
  notEnoughSeats,
  keyVerificationFailed,
  unableToVerify,
  connectionFailed,
}

export interface ProjectEventMap {
  log: { type: string };
  projectStateChanged: ProjectState;
  deviceSettingsChanged: DeviceSettings;
  toolsStateChanged: ToolsState;
  licenseActivationChanged: boolean;
  navigationChanged: { displayName: string; id: string };
  needsNativeRebuild: void;
  replayDataCreated: MultimediaData;
  isRecording: boolean;
  navigationInit: { displayName: string; id: string }[];
}

export interface ProjectEventListener<T> {
  (event: T): void;
}

export type MultimediaData = {
  url: string;
  tempFileLocation: string;
  fileName: string;
};

export interface ProjectInterface {
  getProjectState(): Promise<ProjectState>;
  reload(type: ReloadAction): Promise<boolean>;
  restart(clean: "all" | "metro" | false): Promise<void>;
  goHome(homeUrl: string): Promise<void>;
  selectDevice(deviceInfo: DeviceInfo): Promise<boolean>;
  renameDevice(deviceInfo: DeviceInfo, newDisplayName: string): Promise<void>;
  updatePreviewZoomLevel(zoom: ZoomLevelType): Promise<void>;

  getDeviceSettings(): Promise<DeviceSettings>;
  updateDeviceSettings(deviceSettings: DeviceSettings): Promise<void>;
  sendBiometricAuthorization(match: boolean): Promise<void>;

  getToolsState(): Promise<ToolsState>;
  updateToolEnabledState(toolName: keyof ToolsState, enabled: boolean): Promise<void>;
  openTool(toolName: keyof ToolsState): Promise<void>;

  resumeDebugger(): Promise<void>;
  stepOverDebugger(): Promise<void>;
  focusBuildOutput(): Promise<void>;
  focusExtensionLogsOutput(): Promise<void>;
  focusDebugConsole(): Promise<void>;
  openNavigation(navigationItemID: string): Promise<void>;
  openDevMenu(): Promise<void>;

  activateLicense(activationKey: string): Promise<ActivateDeviceResult>;
  hasActiveLicense(): Promise<boolean>;

  resetAppPermissions(permissionType: AppPermissionType): Promise<void>;

  getDeepLinksHistory(): Promise<string[]>;
  openDeepLink(link: string): Promise<void>;

  startRecording(): void;
  captureAndStopRecording(): void;
  captureReplay(): void;
  captureScreenshot(): void;

  dispatchTouches(touches: Array<TouchPoint>, type: "Up" | "Move" | "Down"): void;
  dispatchKeyPress(keyCode: number, direction: "Up" | "Down"): void;
  dispatchWheel(point: TouchPoint, deltaX: number, deltaY: number): void;
  dispatchPaste(text: string): Promise<void>;
  dispatchCopy(): Promise<void>;
  inspectElementAt(
    xRatio: number,
    yRatio: number,
    requestStack: boolean,
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
