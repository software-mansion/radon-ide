import { BuildType } from "./BuildConfig";
import { DevicePlatform } from "./DeviceManager";
import { DeviceSettings } from "./DeviceSessionsManager";

export const DEVICE_SETTINGS_DEFAULT: DeviceSettings = {
  appearance: "dark",
  contentSize: "normal",
  location: {
    latitude: 50.048653,
    longitude: 19.965474,
    isDisabled: false,
  },
  hasEnrolledBiometrics: false,
  locale: "en_US",
  replaysEnabled: false,
  showTouches: false,
};

export type StartOptions = {
  cleanBuild: boolean;
  resetMetroCache: boolean;
};

export type RestartOptions = {
  forceClean: boolean;
  cleanCache: boolean;
};

export type AppEvent = {
  navigationChanged: { displayName: string; id: string };
  fastRefreshStarted: undefined;
  fastRefreshComplete: undefined;
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
  { StartupMessage: StartupMessage.InitializingDevice, weight: 1 },
  { StartupMessage: StartupMessage.StartingPackager, weight: 1 },
  { StartupMessage: StartupMessage.BootingDevice, weight: 2 },
  { StartupMessage: StartupMessage.Building, weight: 7 },
  { StartupMessage: StartupMessage.Installing, weight: 1 },
  { StartupMessage: StartupMessage.Launching, weight: 1 },
  { StartupMessage: StartupMessage.WaitingForAppToLoad, weight: 6 },
  { StartupMessage: StartupMessage.AttachingDebugger, weight: 1 },
];

export type DeviceState =
  | ({
      status:
        | "starting"
        | "running"
        | "bootError"
        | "bundlingError"
        | "debuggerPaused"
        | "refreshing";
    } & DeviceStateCommon)
  | DeviceStateBuildError;

type DeviceStateCommon = {
  isActive: boolean;
  previewURL: string | undefined;
  initialized: boolean;
  startupMessage: StartupMessage | undefined;
  stageProgress: number | undefined;
  isProfilingCPU: boolean;
  isRecording: boolean;
};

type DeviceStateBuildError = {
  status: "buildError";
  buildError: {
    message: string;
    platform: DevicePlatform;
    buildType: BuildType | null;
  };
} & DeviceStateCommon;

export class DeviceBootError extends Error {
  constructor(
    message: string,
    public readonly cause: unknown
  ) {
    super(message);
  }
}

export interface DeviceSessionInterface {}
