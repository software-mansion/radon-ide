import { ConfigurationChangeEvent, workspace, Disposable } from "vscode";
import {
  PanelLocation,
  WorkspaceConfig,
  WorkspaceConfigProps,
  WorkspaceConfigEventMap,
  WorkspaceConfigEventListener,
} from "../common/WorkspaceConfig";
import { EventEmitter } from "stream";

export class WorkspaceConfigController implements Disposable, WorkspaceConfig {
  private config: WorkspaceConfigProps;
  private eventEmitter = new EventEmitter();
  private configListener: Disposable | undefined;

  constructor() {
    const configuration = workspace.getConfiguration("ReactNativeIDE");
    this.config = {
      panelLocation: configuration.get<PanelLocation>("panelLocation")!,
      relativeAppLocation: configuration.get<string>("relativeAppLocation")!,
    };

    this.configListener = workspace.onDidChangeConfiguration((event: ConfigurationChangeEvent) => {
      if (!event.affectsConfiguration("ReactNativeIDE")) {
        return;
      }
      const configuration = workspace.getConfiguration("ReactNativeIDE");
      this.config = {
        panelLocation: configuration.get<PanelLocation>("panelLocation")!,
        relativeAppLocation: configuration.get<string>("relativeAppLocation")!,
      };
      this.eventEmitter.emit("configChange", this.config);
    });
  }

  async getConfig() {
    return this.config;
  }

  async update<K extends keyof WorkspaceConfigProps>(
    key: K,
    value: WorkspaceConfigProps[K],
    configurationTarget?: boolean
  ) {
    const configuration = workspace.getConfiguration("ReactNativeIDE");
    await configuration.update(key as string, value, configurationTarget);
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
    this.configListener?.dispose();
  }
}
