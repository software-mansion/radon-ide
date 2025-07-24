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

export type State = {
  applicationRoots: ApplicationRoot[];
  workspaceConfiguration: WorkspaceConfiguration;
};

export type StateListener = (state: RecursivePartial<State>) => void;

export const initialState: State = {
  applicationRoots: [],
  workspaceConfiguration: {
    panelLocation: "tab",
    showDeviceFrame: true,
    stopPreviousDevices: false,
  },
};
