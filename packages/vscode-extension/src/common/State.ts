import { ApplicationRoot } from "./AppRootConfig";
import { BuildType } from "./BuildConfig";
import { LicenseState, LicenseStatus } from "./License";
import { merge } from "./Merge";
import { DeviceId } from "./Project";

export const REMOVE = Symbol("remove");

export type RecursivePartial<T> = {
  [P in keyof T]?: NonNullable<T[P]> extends Array<infer U>
    ? Array<U> | undefined | typeof REMOVE
    : RecursivePartial<T[P]> | typeof REMOVE;
};

// #region State Serializer

export class StateSerializer {
  static serialize<T>(state: RecursivePartial<T>): string {
    return JSON.stringify(state, (_, value) => {
      if (typeof value === "symbol") {
        return { __symbol__: value.toString() };
      }
      return value;
    });
  }

  static deserialize<T>(json: string): RecursivePartial<T> {
    return JSON.parse(json, (_, value) => {
      if (value && value.__symbol__ === "Symbol(remove)") {
        return REMOVE;
      }
      return value;
    });
  }
}

// #endregion State Serializer

// #region Device Settings

export type Appearance = "light" | "dark";

export type CameraSource = "emulated" | "none" | "webcam0";
export type FrontCameraSource = CameraSource;
export type BackCameraSource = CameraSource | "virtualscene";

export interface CameraSettings {
  back: BackCameraSource;
  front: FrontCameraSource;
}

export type ContentSize =
  | "xsmall"
  | "small"
  | "normal"
  | "large"
  | "xlarge"
  | "xxlarge"
  | "xxxlarge";

export type Location = {
  latitude: number;
  longitude: number;
  isDisabled: boolean;
};

export type Locale = string;

export type DeviceSettings = {
  appearance: Appearance;
  contentSize: ContentSize;
  deviceRotation: DeviceRotation;
  location: Location;
  hasEnrolledBiometrics: boolean;
  locale: Locale;
  replaysEnabled: boolean;
  showTouches: boolean;
  camera?: CameraSettings;
};

// #endregion Device Settings

// #region Workspace Configuration

export type PanelLocation = "tab" | "side-panel";

export type GeneralSettings = {
  defaultMultimediaSavingLocation: string | null;
  enableExperimentalElementInspector: boolean;
  inspectorExcludePattern: string | null;
};

export type UserInterfaceSettings = {
  panelLocation: PanelLocation;
  showDeviceFrame: boolean;
};

export type DeviceControlSettings = {
  startDeviceOnLaunch: boolean;
  stopPreviousDevices: boolean;
};

export type WorkspaceConfiguration = {
  general: GeneralSettings;
  userInterface: UserInterfaceSettings;
  deviceSettings: DeviceSettings;
  deviceControl: DeviceControlSettings;
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

// #region Radon AI State

export enum RadonAIEnabledState {
  Enabled = "enabled",
  Default = "default",
}

// #endregion Radon AI State

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

// #region Device Session Status

export enum InstallationErrorReason {
  NotEnoughStorage = "not_enough_storage",
  InvalidPlatform = "invalid_platform",
  Unknown = "unknown",
}

export class InstallationError extends Error {
  constructor(
    message: string,
    public readonly reason: InstallationErrorReason
  ) {
    super(message);
  }
}

export type MetroErrorDescriptor = {
  kind: "metro";
  message: string;
};

export type BuildErrorDescriptor = {
  kind: "build";
  message: string;
  platform: DevicePlatform;
  buildType: BuildType | null;
};

export type DeviceErrorDescriptor = {
  kind: "device";
  message: string;
};

export type InstallationErrorDescriptor = {
  kind: "installation";
  message: string;
  platform: DevicePlatform;
  reason: InstallationErrorReason;
};

export type FatalErrorDescriptor =
  | MetroErrorDescriptor
  | BuildErrorDescriptor
  | DeviceErrorDescriptor
  | InstallationErrorDescriptor;

export type DeviceSessionStatus = "starting" | "running" | "fatalError";

export type DeviceSessionStateStarting = {
  status: "starting";
  startupMessage: StartupMessage;
  stageProgress: number;
};

export type DeviceSessionStateRunning = {
  status: "running";
};

export type DeviceSessionStateFatalError = {
  status: "fatalError";
  error: FatalErrorDescriptor;
};

// #endregion Device Session status

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

// #region Navigation

export type NavigationHistoryItem = {
  displayName: string | undefined;
  id: string;
  canGoBack: boolean;
};

export type NavigationRoute = {
  path: string;
  filePath: string;
  children: NavigationRoute[];
  dynamic: { name: string; deep: boolean; notFound?: boolean }[] | null;
  type: string;
};

export type NavigationState = {
  navigationHistory: NavigationHistoryItem[];
  navigationRouteList: NavigationRoute[];
};

// #endregion Navigation

// #region Startup Messages

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

// #endregion Startup Messages

// #region Device Session

export type DeviceSessionStore = {
  applicationSession: ApplicationSessionState;
  deviceInfo: DeviceInfo;
  frameReporting: FrameReportingState;
  isUsingStaleBuild: boolean;
  navigationState: NavigationState;
  previewURL: string | undefined;
  fileTransfer: FileTransferState;
  screenCapture: ScreenCaptureState;
} & (DeviceSessionStateStarting | DeviceSessionStateRunning | DeviceSessionStateFatalError);

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

export type DeviceInfo = AndroidEmulatorInfo | AndroidPhysicalDeviceInfo | IOSDeviceInfo;

export type AndroidEmulatorInfo = AndroidDeviceInfo & {
  avdId: string;
  emulator: true;
};

export type AndroidPhysicalDeviceInfo = AndroidDeviceInfo & {
  emulator: false;
  properties: {
    screenWidth: number;
    screenHeight: number;
  };
};

export type AndroidDeviceInfo = {
  id: string;
  platform: DevicePlatform.Android;
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

export type DevicesByType = {
  androidEmulators: AndroidEmulatorInfo[] | null;
  androidPhysicalDevices: AndroidPhysicalDeviceInfo[] | null;
  iosSimulators: IOSDeviceInfo[] | null;
};

export type DevicesState = {
  devicesByType: DevicesByType;
  androidImages: AndroidSystemImageInfo[] | null;
  iOSRuntimes: IOSRuntimeInfo[] | null;
};

// #endregion Devices State

export type State = {
  applicationRoots: ApplicationRoot[];
  devicesState: DevicesState;
  environmentDependencies: EnvironmentDependencyStatuses;
  license: LicenseState;
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

export const generateInitialDeviceSessionStore = (
  partialDeviceSessionStore: RecursivePartial<DeviceSessionStore> = {}
) => {
  return merge(initialDeviceSessionStore, partialDeviceSessionStore);
};

const initialDeviceSessionStore: DeviceSessionStore = {
  applicationSession: initialApplicationSessionState,
  deviceInfo: {} as DeviceInfo,
  frameReporting: {
    enabled: false,
    frameReport: null,
  },
  isUsingStaleBuild: false,
  navigationState: {
    navigationHistory: [],
    navigationRouteList: [],
  },
  previewURL: undefined,
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
  stageProgress: 0,
  startupMessage: StartupMessage.InitializingDevice,
  status: "starting",
};

export const initialState: State = {
  applicationRoots: [],
  devicesState: {
    devicesByType: {
      iosSimulators: null,
      androidEmulators: null,
      androidPhysicalDevices: null,
    },
    androidImages: null,
    iOSRuntimes: null,
  },
  environmentDependencies: {},
  license: {
    status: LicenseStatus.Inactive,
  },
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
    general: {
      defaultMultimediaSavingLocation: null,
      enableExperimentalElementInspector: false,
      inspectorExcludePattern: null,
    },
    userInterface: {
      panelLocation: "tab",
      showDeviceFrame: true,
    },
    deviceSettings: {
      deviceRotation: DeviceRotation.Portrait,
      appearance: "light",
      contentSize: "normal",
      location: {
        latitude: 37.78825,
        longitude: -122.4324,
        isDisabled: true,
      },
      hasEnrolledBiometrics: false,
      locale: "en_US",
      replaysEnabled: false,
      showTouches: false,
      camera: {
        back: "emulated",
        front: "none",
      },
    },
    deviceControl: {
      startDeviceOnLaunch: true,
      stopPreviousDevices: false,
    },
  },
};

// #endregion Initial State
