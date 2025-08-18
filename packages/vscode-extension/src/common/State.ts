import { ApplicationRoot } from "./AppRootConfig";
import { DeviceRotation } from "./Project";

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

// #region Project State

export type ProjectStore = {
  applicationContext: ApplicationContextState;
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
  runtimeInfo: IOSRuntimeInfo;
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
  },
};

// #endregion Initial State
