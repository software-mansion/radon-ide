export const MinSupportedVersion = {
  reactNative: "0.71.0",
  expo: "49.0.0",
  storybook: "5.2.0",
  expoRouter: "0.0.0",
} as const;

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

export type InstallationStatus = "installed" | "notInstalled" | "installing";
export type DependencyListener = (dependency: Dependency, status: DependencyStatus) => void;
export type DependencyStatus = {
  status: InstallationStatus;
  isOptional: boolean;
};

export interface DependencyManager {
  getStatus(dependencies: Dependency[]): Promise<Record<Dependency, DependencyStatus>>;
  installNodeModules2(): Promise<void>;
  installPods2(): Promise<void>;

  addListener(listener: DependencyListener): Promise<void>;
  removeListener(listener: DependencyListener): Promise<void>;
}
