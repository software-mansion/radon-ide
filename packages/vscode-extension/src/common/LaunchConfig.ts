export type EasConfig = { profile: string; buildUUID?: string; local?: boolean };
export type CustomBuild = {
  buildCommand?: string;
  fingerprintCommand?: string;
};

/**
 * Represents the options for building and launching an application in Radon IDE.
 */
export interface LaunchOptions {
  name?: string;
  appRoot?: string;
  metroConfigPath?: string;
  expoStartArgs?: string[];
  customBuild?: {
    ios?: CustomBuild;
    android?: CustomBuild;
  };
  eas?: {
    ios?: EasConfig;
    android?: EasConfig;
  };
  env?: Record<string, string>;
  ios?: IOSLaunchOptions;
  isExpo?: boolean;
  android?: AndroidLaunchOptions;
  packageManager?: string;
  preview?: {
    waitForAppLaunch?: boolean;
  };
  usePrebuild?: boolean;
  useOldDevtools?: boolean;
  useCustomJSDebugger?: boolean;
  metroPort?: number;
  disableNativeBuildStaleChecks?: boolean;
}

export const LAUNCH_OPTIONS_KEYS = [
  "name",
  "appRoot",
  "metroConfigPath",
  "expoStartArgs",
  "customBuild",
  "eas",
  "env",
  "ios",
  "isExpo",
  "android",
  "packageManager",
  "preview",
  "usePrebuild",
  "useOldDevtools",
  "useCustomJSDebugger",
  "metroPort",
  "disableNativeBuildStaleChecks",
] as const;

type IsSuperTypeOf<Base, T extends Base> = T;
// Type level proof that the strings in `LAUNCH_OPTIONS_KEYS` cover all keys `LaunchConfigurationOptions`.
type _AssertKeysCover = IsSuperTypeOf<
  Required<LaunchOptions>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Record<(typeof LAUNCH_OPTIONS_KEYS)[number], any>
>;
// Type level proof that the strings in `LAUNCH_OPTIONS_KEYS` are valid keys of `LaunchConfigurationOptions`.
type _AssertKeysValid = IsSuperTypeOf<keyof LaunchOptions, (typeof LAUNCH_OPTIONS_KEYS)[number]>;

export interface IOSLaunchOptions {
  scheme?: string;
  configuration?: string;
  launchArguments?: string[];
}

export interface AndroidLaunchOptions {
  buildType?: string;
  productFlavor?: string;
}

export enum LaunchConfigurationKind {
  Custom = "Custom",
  Detected = "Detected",
}

/**
 * A serializable representation of a launch configuration.
 * Includes the options specified in `LaunchOptions` as well as relevant data useful in the presentation layer.
 */
export type LaunchConfiguration = LaunchOptions & {
  kind: LaunchConfigurationKind;
  appRoot: string;
};
