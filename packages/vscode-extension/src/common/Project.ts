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

export type ProjectState = {
  previewZoom: ZoomLevelType | undefined; 
  selectedDevice: string | undefined;
};

export type ZoomLevelType = number | "Fit";

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
  isProfilingCPU: boolean;
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
  // renameDevice(deviceInfo: DeviceInfo, newDisplayName: string): Promise<void>; //.Frytki handle it on device manager directaly 
  updatePreviewZoomLevel(zoom: ZoomLevelType): Promise<void>;

  runCommand(command: string): Promise<void>;

  focusExtensionLogsOutput(): Promise<void>;
  focusDebugConsole(): Promise<void>;

  activateLicense(activationKey: string): Promise<ActivateDeviceResult>;
  hasActiveLicense(): Promise<boolean>;

  getDeepLinksHistory(): Promise<string[]>;

  addListener<K extends keyof ProjectEventMap>(
    eventType: K,
    listener: ProjectEventListener<ProjectEventMap[K]>
  ): Promise<void>;
  removeListener<K extends keyof ProjectEventMap>(
    eventType: K,
    listener: ProjectEventListener<ProjectEventMap[K]>
  ): Promise<void>;
}
