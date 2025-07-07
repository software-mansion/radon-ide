import _ from "lodash";
import { EasBuildConfig } from "./EasConfig";

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

// NOTE: when serializing the LaunchConfiguration, we want to omit the default and computed values.
// This function is a messy attempt at that, and should be kept in sync with both the type definition
// and the `launchConfigurationFromOptions` function in `/project/launchConfigurationsManager`.
export function optionsForLaunchConfiguration(
  config: LaunchConfiguration
): LaunchConfigurationOptions {
  const options: LaunchConfigurationOptions & Partial<LaunchConfiguration> = { ...config };
  delete options.absoluteAppRoot;
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

export type LaunchConfiguration = LaunchConfigurationOptions & {
  absoluteAppRoot: string;
  appRoot: string;
  env: Record<string, string>;
  preview: {
    waitForAppLaunch: boolean;
  };
};

export interface LaunchConfigEventMap {
  launchConfigChange: LaunchConfigurationOptions;
  applicationRootsChanged: void;
}

export interface LaunchConfigEventListener<T> {
  (event: T): void;
}

export type LaunchConfigUpdater = <K extends keyof LaunchConfigurationOptions>(
  key: K,
  value: LaunchConfigurationOptions[K] | "Auto"
) => void;

export type AddCustomApplicationRoot = (appRoot: string) => void;

export type ApplicationRoot = {
  path: string;
  name: string;
  displayName?: string;
};

export interface LaunchConfig {
  getConfig(): Promise<LaunchConfigurationOptions>;
  update: LaunchConfigUpdater;
  addCustomApplicationRoot: AddCustomApplicationRoot;
  getAvailableXcodeSchemes(): Promise<string[]>;
  getAvailableApplicationRoots(): Promise<ApplicationRoot[]>;
  getAvailableEasProfiles(): Promise<EasBuildConfig>;
  addListener<K extends keyof LaunchConfigEventMap>(
    eventType: K,
    listener: LaunchConfigEventListener<LaunchConfigEventMap[K]>
  ): Promise<void>;
  removeListener<K extends keyof LaunchConfigEventMap>(
    eventType: K,
    listener: LaunchConfigEventListener<LaunchConfigEventMap[K]>
  ): Promise<void>;
}
