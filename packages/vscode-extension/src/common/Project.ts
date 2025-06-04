import { BuildType } from "./BuildConfig";
import { DeviceInfo, DevicePlatform } from "./DeviceManager";

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

export type ToolState = {
  enabled: boolean;
  panelAvailable: boolean;
  label: string;
};

export type ToolsState = {
  [key: string]: ToolState;
};

export type BuildErrorDescriptor = {
  message: string;
  platform: DevicePlatform;
  buildType: BuildType | null;
};

export type ProfilingState = "stopped" | "profiling" | "saving";

export type NavigationHistoryItem = {
  displayName: string;
  id: string;
};

export type NavigationRoute = {
  path: string;
  filePath: string;
  children: NavigationRoute[];
  dynamic: { name: string; deep: boolean; notFound?: boolean }[] | null;
  type: string;
};

export type DeviceSessionStatus =
  | "starting"
  | "running"
  | "bootError"
  | "bundlingError"
  | "buildError";

export type DeviceSessionState = {
  status: DeviceSessionStatus;
  startupMessage: StartupMessage | undefined;
  stageProgress: number | undefined;
  buildError: BuildErrorDescriptor | undefined;
  isRefreshing: boolean;
  deviceInfo: DeviceInfo | undefined;
  previewURL: string | undefined;
  profilingReactState: ProfilingState;
  profilingCPUState: ProfilingState;
  navigationHistory: NavigationHistoryItem[];
  navigationRouteList: NavigationRoute[];
  toolsState: ToolsState;
  isDebuggerPaused: boolean;
  logCounter: number;
  hasStaleBuildCache: boolean;
  isRecordingScreen: boolean;
};

export const DEVICE_SESSION_INITIAL_STATE: DeviceSessionState = {
  status: "starting",
  startupMessage: undefined,
  stageProgress: undefined,
  buildError: undefined,
  isRefreshing: false,
  deviceInfo: undefined,
  previewURL: undefined,
  profilingReactState: "stopped",
  profilingCPUState: "stopped",
  navigationHistory: [],
  navigationRouteList: [],
  toolsState: {},
  isDebuggerPaused: false,
  logCounter: 0,
  hasStaleBuildCache: false,
  isRecordingScreen: false,
};

export type DeviceId = DeviceInfo["id"];

export type ProjectState = {
  initialized: boolean;
  appRootPath: string | undefined;
  previewZoom: ZoomLevelType | undefined; // Preview specific. Consider extracting to different location if we store more preview state
  selectedSessionId: DeviceId | null;
  deviceSessions: Record<DeviceId, DeviceSessionState>;
};

export type ZoomLevelType = number | "Fit";

export type AppPermissionType = "all" | "location" | "photos" | "contacts" | "calendar";

export type DeviceButtonType = "home" | "back" | "appSwitch" | "volumeUp" | "volumeDown";

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
  projectStateChanged: ProjectState;
  deviceSettingsChanged: DeviceSettings;
  licenseActivationChanged: boolean;
  replayDataCreated: MultimediaData;
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
  renameDevice(deviceInfo: DeviceInfo, newDisplayName: string): Promise<void>;
  updatePreviewZoomLevel(zoom: ZoomLevelType): Promise<void>;

  getDeviceSettings(): Promise<DeviceSettings>;
  updateDeviceSettings(deviceSettings: DeviceSettings): Promise<void>;
  runCommand(command: string): Promise<void>;

  updateToolEnabledState(toolName: keyof ToolsState, enabled: boolean): Promise<void>;
  openTool(toolName: keyof ToolsState): Promise<void>;

  resumeDebugger(): Promise<void>;
  stepOverDebugger(): Promise<void>;
  focusBuildOutput(): Promise<void>;
  focusExtensionLogsOutput(): Promise<void>;
  focusDebugConsole(): Promise<void>;
  openNavigation(navigationItemID: string): Promise<void>;
  navigateBack(): Promise<void>;
  navigateHome(): Promise<void>;
  openDevMenu(): Promise<void>;

  activateLicense(activationKey: string): Promise<ActivateDeviceResult>;
  hasActiveLicense(): Promise<boolean>;

  resetAppPermissions(permissionType: AppPermissionType): Promise<void>;

  getDeepLinksHistory(): Promise<string[]>;
  openDeepLink(link: string, terminateApp: boolean): Promise<void>;

  startRecording(): void;
  captureAndStopRecording(): void;
  captureReplay(): void;
  captureScreenshot(): void;

  startProfilingCPU(): void;
  stopProfilingCPU(): void;

  startProfilingReact(): void;
  stopProfilingReact(): void;

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
