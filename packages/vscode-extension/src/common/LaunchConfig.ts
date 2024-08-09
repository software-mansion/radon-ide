export type LaunchConfigProps = {
  android?: {
    buildType?: string;
    productFlavor?: string;
  };
  appRoot?: string;
  ios?: {
    scheme?: string;
    configuration?: string;
  };
  isExpo?: boolean;
  metroConfigPath?: string;
  env?: object;
};

export interface LaunchConfigEventMap {
  launchConfigChange: LaunchConfigProps;
}

export interface LaunchConfigEventListener<T> {
  (event: T): void;
}

export interface LaunchConfig {
  getConfig(): Promise<LaunchConfigProps>;
  // update method can take any of the keys from WorkspaceConfigProps and appropriate value:
  update<K extends keyof LaunchConfigProps>(key: K, value: LaunchConfigProps[K]): Promise<void>;
  addListener<K extends keyof LaunchConfigEventMap>(
    eventType: K,
    listener: LaunchConfigEventListener<LaunchConfigEventMap[K]>
  ): Promise<void>;
  removeListener<K extends keyof LaunchConfigEventMap>(
    eventType: K,
    listener: LaunchConfigEventListener<LaunchConfigEventMap[K]>
  ): Promise<void>;
}
