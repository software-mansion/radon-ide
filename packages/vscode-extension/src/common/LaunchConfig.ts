export type LaunchConfigurationOptions = {
  appRoot?: string;
  metroConfigPath?: string;
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
}

export interface LaunchConfigEventListener<T> {
  (event: T): void;
}

export interface LaunchConfig {
  getConfig(): Promise<LaunchConfigurationOptions>;
  // update method can take any of the keys from WorkspaceConfigProps and appropriate value:
  update<K extends keyof LaunchConfigurationOptions>(
    key: K,
    value: LaunchConfigurationOptions[K]
  ): Promise<void>;

  getAvailableXcodeSchemes(): Promise<string[]>;
  addListener<K extends keyof LaunchConfigEventMap>(
    eventType: K,
    listener: LaunchConfigEventListener<LaunchConfigEventMap[K]>
  ): Promise<void>;
  removeListener<K extends keyof LaunchConfigEventMap>(
    eventType: K,
    listener: LaunchConfigEventListener<LaunchConfigEventMap[K]>
  ): Promise<void>;
}
