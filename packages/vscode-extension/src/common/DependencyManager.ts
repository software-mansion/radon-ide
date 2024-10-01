export type Dependency =
  | "androidEmulator"
  | "xcode"
  | "cocoaPods"
  | "nodejs"
  | "nodeModules"
  | "reactNative"
  | "pods"
  | "expo"
  | "expoRouter"
  | "storybook";

export enum InstallationStatus {
  NotInstalled,
  InProgress,
  Installed,
  Optional,
}

export interface DependencyState {
  installed: boolean;
  info: string;
  isOptional?: boolean;
  error?: string;
}

export interface DependencyManager {
  getDependencyStatus(dependency: Dependency): Promise<DependencyState>;
  installNodeModules(): Promise<void>;
  installPods(): Promise<void>;
}
