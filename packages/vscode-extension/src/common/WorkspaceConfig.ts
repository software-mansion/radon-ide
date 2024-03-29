export type PanelLocation = "tab" | "side-panel" | "secondary-side-panel";

export type WorkspaceConfigProps = {
  panelLocation: PanelLocation;
  relativeAppLocation: string;
};

export interface WorkspaceConfigEventMap {
  configChange: WorkspaceConfigProps;
}

export interface WorkspaceConfigEventListener<T> {
  (event: T): void;
}

export interface WorkspaceConfig {
  getConfig(): Promise<WorkspaceConfigProps>;
  // update method can take any of the keys from WorkspaceConfigProps and appropriate value:
  updateUserLevel<K extends keyof WorkspaceConfigProps>(
    key: K,
    value: WorkspaceConfigProps[K]
  ): Promise<void>;
  addListener<K extends keyof WorkspaceConfigEventMap>(
    eventType: K,
    listener: WorkspaceConfigEventListener<WorkspaceConfigEventMap[K]>
  ): Promise<void>;
  removeListener<K extends keyof WorkspaceConfigEventMap>(
    eventType: K,
    listener: WorkspaceConfigEventListener<WorkspaceConfigEventMap[K]>
  ): Promise<void>;
}
