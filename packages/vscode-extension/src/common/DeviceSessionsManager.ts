import { DeviceId, DeviceInfo } from "./DeviceManager";
import { DeviceState } from "./DeviceSession";

export type ReloadAction =
  | "autoReload" // automatic reload mode
  | "clearMetro" // clear metro cache, boot device, install app
  | "rebuild" // clean build, boot device, install app
  | "reboot" // reboots device, launch app
  | "reinstall" // force reinstall app
  | "restartProcess" // relaunch app
  | "reloadJs"; // refetch JS scripts from metro

export type DeviceSessionsManagerDelegate = {
  ensureDependenciesAndNodeVersion(): Promise<void>;
  onOpenDeepLink(link: string): Promise<void>;
};

export type AppPermissionType = "all" | "location" | "photos" | "contacts" | "calendar";

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

export type DeviceButtonType = "home" | "back" | "appSwitch" | "volumeUp" | "volumeDown";

export interface DeviceSessionsManagerInterface {
  getDeviceState(id: DeviceId): Promise<DeviceState>;
  reload(id: DeviceId, type: ReloadAction): Promise<boolean>;
  stopDevice(deviceId: DeviceId): Promise<boolean>;
  initializeDevice(id: DeviceInfo): Promise<boolean>;
  listRunningDevices(): Promise<DeviceId[]>;
  activateDevice(id: DeviceId): Promise<void>;
  deactivateDevice(id: DeviceId): Promise<void>;

  openDeepLink(deviceId: DeviceId, link: string, terminateApp: boolean): Promise<void>;
  goHome(deviceId: DeviceId, homeUrl: string): Promise<void>;
  getDeviceSettings(deviceId: DeviceId): Promise<DeviceSettings>;
  updateDeviceSettings(deviceId: DeviceId, deviceSettings: DeviceSettings): Promise<void>;
  resetAppPermissions(deviceId: DeviceId, permissionType: AppPermissionType): Promise<void>;

  dispatchTouches(
    deviceId: DeviceId,
    touches: Array<TouchPoint>,
    type: "Up" | "Move" | "Down"
  ): void;
  dispatchKeyPress(deviceId: DeviceId, keyCode: number, direction: "Up" | "Down"): void;
  dispatchWheel(deviceId: DeviceId, point: TouchPoint, deltaX: number, deltaY: number): void;
  inspectElementAt(
    deviceId: DeviceId,
    xRatio: number,
    yRatio: number,
    requestStack: boolean,
    callback: (inspectData: InspectData) => void
  ): Promise<void>;

  startRecording(id: DeviceId): void;
  captureAndStopRecording(id: DeviceId): void;
  captureReplay(id: DeviceId): void;
  captureScreenshot(id: DeviceId): void;

  getToolsState(id: DeviceId): Promise<ToolsState>;
  updateToolEnabledState(id: DeviceId, toolName: keyof ToolsState, enabled: boolean): Promise<void>;
  openTool(id: DeviceId, toolName: keyof ToolsState): Promise<void>;
  openDevMenu(deviceId: DeviceId): Promise<void>;

  resumeDebugger(id: DeviceId): Promise<void>;
  stepOverDebugger(id: DeviceId): Promise<void>;
  focusBuildOutput(id: DeviceId): Promise<void>;

  startProfilingCPU(id: DeviceId): void;
  stopProfilingCPU(id: DeviceId): void;

  dispatchPaste(id: DeviceId, text: string): Promise<void>;
  dispatchCopy(id: DeviceId): Promise<void>;

  openNavigation(id: DeviceId, navigationItemID: string): Promise<void>;

  addListener<K extends keyof DeviceSessionManagerEventMap>(
    eventType: K,
    listener: DeviceSessionManagerEventListener<DeviceSessionManagerEventMap[K]>
  ): Promise<void>;
  removeListener<K extends keyof DeviceSessionManagerEventMap>(
    eventType: K,
    listener: DeviceSessionManagerEventListener<DeviceSessionManagerEventMap[K]>
  ): Promise<void>;
}
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

export type MultimediaData = {
  url: string;
  tempFileLocation: string;
  fileName: string;
};

export type ToolState = {
  enabled: boolean;
  panelAvailable: boolean;
  label: string;
};

export type ToolsState = {
  [key: string]: ToolState;
};

export interface DeviceSessionManagerEventListener<T> {
  (event: T): void;
}

export interface DeviceSessionManagerEventMap {
  runningDevicesChanged: DeviceId[];
  log: { deviceId: DeviceId; payload: { type: string } };
  deviceStateChanged: { deviceId: DeviceId; deviceState: DeviceState };
  deviceSettingsChanged: { deviceId: DeviceId; deviceSettings: DeviceSettings };
  toolsStateChanged: { deviceId: DeviceId; toolsState: ToolsState };
  navigationChanged: { deviceId: DeviceId; displayName: string; id: string };
  needsNativeRebuild: { deviceId: DeviceId };
  replayDataCreated: { deviceId: DeviceId; multimediaData: MultimediaData };
  isRecording: { deviceId: DeviceId; isRecording: boolean };
  isProfilingCPU: { deviceId: DeviceId; isProfiling: boolean };
}
