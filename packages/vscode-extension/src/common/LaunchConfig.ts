import { EasBuildConfig } from "./EasConfig";

export type EasConfig = { profile: string; buildUUID?: string; local?: boolean };
export type CustomBuild = {
  buildCommand?: string;
  fingerprintCommand?: string;
};

export type LaunchConfigurationOptions = Partial<LaunchConfiguration>;

export interface IOSLaunchConfiguration {
  scheme?: string;
  configuration?: string;
  launchArguments?: string[];
}

export interface AndroidLaunchConfiguration {
  buildType?: string;
  productFlavor?: string;
}

export interface LaunchConfiguration {
  appRoot: string;
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
  env: Record<string, string>;
  ios?: IOSLaunchConfiguration;
  isExpo?: boolean;
  android?: AndroidLaunchConfiguration;
  packageManager?: string;
  preview: {
    waitForAppLaunch: boolean;
  };
}

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
