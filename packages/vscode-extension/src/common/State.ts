import { ApplicationRoot } from "./AppRootConfig";

export type RecursivePartial<T> = {
  [P in keyof T]?: RecursivePartial<T[P]>;
};

export type PanelLocation = "tab" | "side-panel";

export type WorkspaceConfiguration = {
  panelLocation: PanelLocation;
  showDeviceFrame: boolean;
  stopPreviousDevices: boolean;
};

export type EnvironmentDependency = "androidEmulator" | "xcode" | "nodejs";

export type ApplicationDependency =
  | "nodeVersion"
  | "packageManager"
  | "cocoaPods"
  | "nodeModules"
  | "ios"
  | "android"
  | "pods"
  | "reactNative"
  | "expo"
  | "expoRouter"
  | "storybook"
  | "easCli";

export type InstallationStatus = "installed" | "notInstalled" | "installing";

export type DependencyStatus = {
  status: InstallationStatus;
  isOptional: boolean;
  details?: string;
};

export type EnvironmentDependencyStatuses = Partial<
  Record<EnvironmentDependency, DependencyStatus>
>;
export type ApplicationDependencyStatuses = Partial<
  Record<ApplicationDependency, DependencyStatus>
>;

export type ProjectStore = {
  applicationContext: ApplicationContextState;
};

export type ApplicationContextState = {
  applicationDependencies: ApplicationDependencyStatuses;
};

export type State = {
  applicationRoots: ApplicationRoot[];
  environmentDependencies: EnvironmentDependencyStatuses;
  projectState: ProjectStore;
  workspaceConfiguration: WorkspaceConfiguration;
};

export type StateListener = (state: RecursivePartial<State>) => void;

export const initialState: State = {
  applicationRoots: [],
  environmentDependencies: {},
  projectState: {
    applicationContext: {
      applicationDependencies: {},
    },
  },
  workspaceConfiguration: {
    panelLocation: "tab",
    showDeviceFrame: true,
    stopPreviousDevices: false,
  },
};
