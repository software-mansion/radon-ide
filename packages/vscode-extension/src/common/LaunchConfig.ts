import _ from "lodash";

export type EasConfig = { profile: string; buildUUID?: string; local?: boolean };
export type CustomBuild = {
  buildCommand?: string;
  fingerprintCommand?: string;
};

export type LaunchConfigurationOptions = {
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
  ios?: IOSLaunchConfiguration;
  isExpo?: boolean;
  android?: AndroidLaunchConfiguration;
  packageManager?: string;
  preview?: {
    waitForAppLaunch?: boolean;
  };
};

export const LAUNCH_CONFIG_OPTIONS_KEYS = [
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
] as const;

type IsSuperTypeOf<Base, T extends Base> = T;
// Type level proof that the strings in `LAUNCH_CONFIG_OPTIONS_KEYS` cover all keys `LaunchConfigurationOptions`.
type _AssertKeysCover = IsSuperTypeOf<
  Required<LaunchConfigurationOptions>,
  Record<(typeof LAUNCH_CONFIG_OPTIONS_KEYS)[number], any>
>;
// Type level proof that the strings in `LAUNCH_CONFIG_OPTIONS_KEYS` are valid keys of `LaunchConfigurationOptions`.
type _AssertKeysValid = IsSuperTypeOf<
  keyof LaunchConfigurationOptions,
  (typeof LAUNCH_CONFIG_OPTIONS_KEYS)[number]
>;

// NOTE: when serializing the LaunchConfiguration, we want to omit the default and computed values.
// This function is a messy attempt at that, and should be kept in sync with both the type definition
// and the `launchConfigurationFromOptions` function in `/project/launchConfigurationsManager`.
export function optionsForLaunchConfiguration(
  config: LaunchConfiguration
): LaunchConfigurationOptions {
  const options: LaunchConfigurationOptions = _.pick(config, LAUNCH_CONFIG_OPTIONS_KEYS);
  if (options.preview?.waitForAppLaunch) {
    delete options.preview;
  }
  return options;
}

export interface IOSLaunchConfiguration {
  scheme?: string;
  configuration?: string;
  launchArguments?: string[];
}

export interface AndroidLaunchConfiguration {
  buildType?: string;
  productFlavor?: string;
}

export enum LaunchConfigurationKind {
  Custom = "Custom",
  Detected = "Detected",
}

export type LaunchConfiguration = LaunchConfigurationOptions & {
  kind: LaunchConfigurationKind;
  absoluteAppRoot: string;
  appRoot: string;
  env: Record<string, string>;
  preview: {
    waitForAppLaunch: boolean;
  };
};
