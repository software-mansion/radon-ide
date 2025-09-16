import { ApplicationRoot } from "./AppRootConfig";
import { DeviceId } from "./Project";

export type RecursivePartial<T> = {
  [P in keyof T]?: NonNullable<T[P]> extends Array<infer U>
    ? Array<U> | undefined
    : RecursivePartial<T[P]>;
};

// #region Workspace Configuration

export type PanelLocation = "tab" | "side-panel";

export type WorkspaceConfiguration = {
  panelLocation: PanelLocation;
  showDeviceFrame: boolean;
  stopPreviousDevices: boolean;
  deviceRotation: DeviceRotation;
  inspectorExcludePattern: string | null;
  defaultMultimediaSavingLocation: string | null;
  startDeviceOnLaunch: boolean;
  enableExperimentalElementInspector: boolean;
};

// #endregion Workspace Configuration

// #region Dependencies

export type EnvironmentDependency = "androidEmulator" | "xcode" | "nodejs";

export type ApplicationDependency =
  | "nodeVersion"
  | "packageManager"
  | "cocoaPods"
  | "nodeModules"
  | "ios"
  | "android"
  | "pods"
  | "reactNative"
  | "expo"
  | "expoRouter"
  | "storybook"
  | "easCli";

export type InstallationStatus = "installed" | "notInstalled" | "installing";

export type DependencyStatus = {
  status: InstallationStatus;
  isOptional: boolean;
  details?: string;
};

export type EnvironmentDependencyStatuses = Partial<
  Record<EnvironmentDependency, DependencyStatus>
>;
export type ApplicationDependencyStatuses = Partial<
  Record<ApplicationDependency, DependencyStatus>
>;

// #endregion Dependencies

// #region Tools State

export type ToolState = {
  enabled: boolean;
  isPanelTool: boolean;
  label: string;
  pluginAvailable: boolean;
  pluginUnavailableTooltip?: string;
};

export type ToolsState = {
  [key: string]: ToolState;
};

// #endregion Tools State

// #region Application Session

export type BundleErrorDescriptor = {
  kind: "bundle";
  message: string;
};

export enum DeviceRotation {
  Portrait = "Portrait",
  PortraitUpsideDown = "PortraitUpsideDown",
  LandscapeLeft = "LandscapeLeft",
  LandscapeRight = "LandscapeRight",
}

export enum InspectorAvailabilityStatus {
  Available = "available",
  UnavailableEdgeToEdge = "unavailableEdgeToEdge",
  UnavailableInactive = "unavailableInactive",
}

export enum InspectorBridgeStatus {
  Connecting,
  Connected,
  Disconnected,
}

export type ProfilingState = "stopped" | "profiling" | "saving";

export type ApplicationSessionState = {
  appOrientation: DeviceRotation | null;
  bundleError: BundleErrorDescriptor | null;
  elementInspectorAvailability: InspectorAvailabilityStatus;
  inspectorBridgeStatus: InspectorBridgeStatus;
  isDebuggerPaused: boolean;
  isRefreshing: boolean;
  logCounter: number;
  profilingCPUState: ProfilingState;
  profilingReactState: ProfilingState;
  toolsState: ToolsState;
};

// #endregion Application Session

// #region Frame Reporting State

export type FrameRateReport = {
  fps: number;
  received: number;
  dropped: number;
  timestamp: number;
};

export type FrameReportingState = {
  enabled: boolean;
  frameReport: FrameRateReport | null;
};

// #endregion Frame Reporting State

// #region File Transfer State

export type FileTransferState = {
  sendingFiles: string[];
  sentFiles: string[];
  erroredFiles: Array<{ fileName: string; errorMessage: string }>;
};

// #endregion File Transfer State
// #region Multimedia

export type MultimediaData = {
  url: string;
  tempFileLocation: string;
  fileName: string;
};

export type ScreenCaptureState = {
  isRecording: boolean;
  recordingTime: number; // in seconds
  replayData: MultimediaData | null;
};

// #endregion Multimedia

// #region Device Session

export type DeviceSessionStore = {
  applicationSession: ApplicationSessionState;
  frameReporting: FrameReportingState;
  fileTransfer: FileTransferState;
  screenCapture: ScreenCaptureState;
};

// #endregion Device Session

// #region Project State

export type DeviceSessions = Record<DeviceId, DeviceSessionStore>;

export type ZoomLevelType = number | "Fit";

export type ProjectStore = {
  applicationContext: ApplicationContextState;
  deviceSessions: DeviceSessions;
  initialized: boolean;
  previewZoom: ZoomLevelType;
  selectedDeviceSessionId: DeviceId | null;
};

// #endregion Project State

// #region ApplicationContext State

export type ApplicationContextState = {
  applicationDependencies: ApplicationDependencyStatuses;
};

// #endregion ApplicationContext State

// #region Telemetry State

export type TelemetryState = {
  enabled: boolean;
};

// #endregion Telemetry State

// #region Devices State

export enum DevicePlatform {
  IOS = "iOS",
  Android = "Android",
}

export enum DeviceType {
  Phone = "Phone",
  Tablet = "Tablet",
}

export type DeviceInfo = AndroidDeviceInfo | IOSDeviceInfo;

export type AndroidDeviceInfo = {
  id: string;
  platform: DevicePlatform.Android;
  avdId: string;
  modelId: string;
  systemName: string;
  displayName: string;
  deviceType: DeviceType;
  available: boolean;
};

export type IOSDeviceInfo = {
  id: string;
  platform: DevicePlatform.IOS;
  UDID: string;
  modelId: string;
  systemName: string;
  displayName: string;
  available: boolean;
  deviceType: DeviceType;
  runtimeInfo?: IOSRuntimeInfo;
};

export type AndroidSystemImageInfo = {
  name: string;
  location: string;
  apiLevel: number;
  available: boolean;
};

export type IOSDeviceTypeInfo = {
  name: string;
  identifier: string;
};

export type IOSRuntimeInfo = {
  platform: "iOS" | "tvOS" | "watchOS";
  identifier: string;
  name: string;
  version: string;
  supportedDeviceTypes: IOSDeviceTypeInfo[];
  available: boolean;
};

export type DevicesState = {
  devices: DeviceInfo[] | null;
  androidImages: AndroidSystemImageInfo[] | null;
  iOSRuntimes: IOSRuntimeInfo[] | null;
};

// #endregion Devices State

export type State = {
  applicationRoots: ApplicationRoot[];
  devicesState: DevicesState;
  environmentDependencies: EnvironmentDependencyStatuses;
  projectState: ProjectStore;
  telemetry: TelemetryState;
  workspaceConfiguration: WorkspaceConfiguration;
};

export type StateListener = (state: RecursivePartial<State>) => void;

// #region Initial State

export const initialApplicationSessionState: ApplicationSessionState = {
  appOrientation: null,
  bundleError: null,
  elementInspectorAvailability: InspectorAvailabilityStatus.Available,
  inspectorBridgeStatus: InspectorBridgeStatus.Connecting,
  isDebuggerPaused: false,
  isRefreshing: false,
  logCounter: 0,
  profilingCPUState: "stopped",
  profilingReactState: "stopped",
  toolsState: {},
};

export const initialDeviceSessionStore: DeviceSessionStore = {
  applicationSession: initialApplicationSessionState,
  frameReporting: {
    enabled: false,
    frameReport: null,
  },
  screenCapture: {
    isRecording: false,
    recordingTime: 0,
    replayData: null,
  },
  fileTransfer: {
    sendingFiles: [],
    sentFiles: [],
    erroredFiles: [],
  },
};

export const initialState: State = {
  applicationRoots: [],
  devicesState: {
    devices: null,
    androidImages: null,
    iOSRuntimes: null,
  },
  environmentDependencies: {},
  projectState: {
    applicationContext: {
      applicationDependencies: {},
    },
    deviceSessions: {},
    initialized: false,
    previewZoom: "Fit",
    selectedDeviceSessionId: null,
  },
  telemetry: {
    enabled: false,
  },
  workspaceConfiguration: {
    panelLocation: "tab",
    showDeviceFrame: true,
    stopPreviousDevices: false,
    deviceRotation: DeviceRotation.Portrait,
    inspectorExcludePattern: null,
    defaultMultimediaSavingLocation: null,
    startDeviceOnLaunch: true,
    enableExperimentalElementInspector: false,
  },
};

// #endregion Initial State
