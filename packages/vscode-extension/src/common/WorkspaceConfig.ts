import { ConfigurationChangeEvent, workspace, Disposable } from "vscode";
import { Tabpanel } from "../panels/Tabpanel";
import { EventEmitter } from "stream";
import { Logger } from "../Logger";

export type WorkspaceConfigProps = {
  showPanelInActivityBar: boolean;
  relativeAppLocation: string;
};

export interface WorkspaceConfigEventMap {
  workspaceConfigChange: WorkspaceConfigProps;
}

export interface WorkspaceConfigEventListener<T> {
  (event: T): void;
}

export interface WorkspaceConfigInterface {
  getWorkspaceConfigProps(): Promise<WorkspaceConfigProps>;
  addListener<K extends keyof WorkspaceConfigEventMap>(
    eventType: K,
    listener: WorkspaceConfigEventListener<WorkspaceConfigEventMap[K]>
  ): Promise<void>;
  removeListener<K extends keyof WorkspaceConfigEventMap>(
    eventType: K,
    listener: WorkspaceConfigEventListener<WorkspaceConfigEventMap[K]>
  ): Promise<void>;
}

export class WorkspaceConfig implements Disposable, WorkspaceConfigInterface {
  public static currentWorkspaceConfig: WorkspaceConfig | undefined;
  private workspaceConfigProps: WorkspaceConfigProps;
  private eventEmitter = new EventEmitter();
  private workspaceConfigListener: Disposable | undefined;

  constructor() {
    WorkspaceConfig.currentWorkspaceConfig = this;
    this.workspaceConfigProps = {
      showPanelInActivityBar: workspace
        .getConfiguration("ReactNativeIDE")
        .get<boolean>("showPanelInActivityBar")!,
      relativeAppLocation: workspace
        .getConfiguration("ReactNativeIDE")
        .get<string>("relativeAppLocation")!,
    };
    this.IDEPanelLocationListener();
  }

  private IDEPanelLocationListener() {
    this.workspaceConfigListener = workspace.onDidChangeConfiguration(
      (event: ConfigurationChangeEvent) => {
        if (!event.affectsConfiguration("ReactNativeIDE")) {
          return;
        }
        if (event.affectsConfiguration("ReactNativeIDE.showPanelInActivityBar")) {
          this.workspaceConfigProps.showPanelInActivityBar = workspace
            .getConfiguration("ReactNativeIDE")
            .get<boolean>("showPanelInActivityBar")!;
          if (workspace.getConfiguration("ReactNativeIDE").get("showPanelInActivityBar")) {
            Tabpanel.currentPanel?.dispose();
          }
        } else if (event.affectsConfiguration("ReactNativeIDE.relativeAppLocation")) {
          this.workspaceConfigProps.relativeAppLocation = workspace
            .getConfiguration("ReactNativeIDE")
            .get<string>("relativeAppLocation")!;
        }
        this.eventEmitter.emit("workspaceConfigChange", this.workspaceConfigProps);
      }
    );
  }

  async getWorkspaceConfigProps(): Promise<WorkspaceConfigProps> {
    return this.workspaceConfigProps;
  }

  async addListener<K extends keyof WorkspaceConfigEventMap>(
    eventType: K,
    listener: WorkspaceConfigEventListener<WorkspaceConfigEventMap[K]>
  ) {
    this.eventEmitter.addListener(eventType, listener);
  }

  async removeListener<K extends keyof WorkspaceConfigEventMap>(
    eventType: K,
    listener: WorkspaceConfigEventListener<WorkspaceConfigEventMap[K]>
  ) {
    this.eventEmitter.removeListener(eventType, listener);
  }

  dispose() {
    this.workspaceConfigListener?.dispose();
  }
}
