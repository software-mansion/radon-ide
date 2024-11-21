export type EasConfig = { profile: string; buildUUID?: string };
export type CustomBuild = {
  buildCommand?: string;
  fingerprintCommand?: string;
};

export type LaunchConfigurationOptions = {
  appRoot?: string;
  metroConfigPath?: string;
  customBuild?: {
    ios?: CustomBuild;
    android?: CustomBuild;
  };
  eas?: {
    ios?: EasConfig;
    android?: EasConfig;
  };
  env?: Record<string, string>;
  ios?: {
    scheme?: string;
    configuration?: string;
  };
  isExpo?: boolean;
  android?: {
    buildType?: string;
    productFlavor?: string;
  };
  preview?: {
    waitForAppLaunch?: boolean;
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

export interface LaunchConfig {
  getConfig(): Promise<LaunchConfigurationOptions>;
  update: LaunchConfigUpdater;
  addCustomApplicationRoot: AddCustomApplicationRoot;
  getAvailableXcodeSchemes(): Promise<string[]>;
  getAvailableApplicationRoots(): Promise<string[]>;
  addListener<K extends keyof LaunchConfigEventMap>(
    eventType: K,
    listener: LaunchConfigEventListener<LaunchConfigEventMap[K]>
  ): Promise<void>;
  removeListener<K extends keyof LaunchConfigEventMap>(
    eventType: K,
    listener: LaunchConfigEventListener<LaunchConfigEventMap[K]>
  ): Promise<void>;
}
