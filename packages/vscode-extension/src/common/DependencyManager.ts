export const MinSupportedVersion = {
  reactNative: "0.71.0",
  expo: "49.0.0",
  storybook: "5.2.0",
} as const;

export type Dependency =
  | "androidEmulator"
  | "xcode"
  | "cocoaPods"
  | "nodejs"
  | "nodeModules"
  | "android"
  | "ios"
  | "pods"
  | "reactNative"
  | "expo"
  | "expoRouter"
  | "storybook";

export type InstallationStatus = "installed" | "notInstalled" | "installing";

export type DependencyStatus = {
  status: InstallationStatus;
  isOptional: boolean;
};

export type DependenciesStatus = Record<Dependency, DependencyStatus>;

export type DependencyListener = (dependency: Dependency, status: DependencyStatus) => void;

export interface DependencyManagerInterface {
  runAllDependencyChecks(): Promise<void>;

  addListener(listener: DependencyListener): Promise<void>;
  removeListener(listener: DependencyListener): Promise<void>;
}
