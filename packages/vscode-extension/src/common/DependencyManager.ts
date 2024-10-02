import type { CancelToken } from "../builders/cancelToken";

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
  | "pods"
  | "reactNative"
  | "expo"
  | "expoRouter"
  | "storybook";

export type InstallationStatus = "installed" | "notInstalled" | "installing";
export type DependencyListener = (
  dependency: Dependency,
  installationStatus: InstallationStatus
) => void;
export type DependencyStatus = {
  status: InstallationStatus;
  isOptional: boolean;
};
export type DependenciesStatus = Record<Dependency, DependencyStatus>;

export type InstallPodsOptions = {
  forceCleanBuild: boolean;
  cancelToken: CancelToken;
};

export interface DependencyManagerInterface {
  getStatus(dependencies: Dependency[]): Promise<Record<Dependency, DependencyStatus>>;
  isInstalled(dependency: Dependency): Promise<boolean>;
  installNodeModules(): Promise<void>;
  installPods(options: InstallPodsOptions): Promise<void>;

  addListener(listener: DependencyListener): Promise<void>;
  removeListener(listener: DependencyListener): Promise<void>;
}
