import { EventEmitter } from "stream";
import { Disposable } from "vscode";
import { Devtools } from "./devtools";
import { extensionContext } from "../utilities/extensionContext";
import { ToolsState } from "../common/Project";
import {
  createExpoDevPluginTools,
  ExpoDevPluginToolName,
} from "../plugins/expo-dev-plugins/expo-dev-plugins";
import { NetworkPlugin, NetworkPluginToolName } from "../plugins/network/network-plugin";

const TOOLS_SETTINGS_KEY = "tools_settings";

export type ToolKey = ExpoDevPluginToolName | NetworkPluginToolName;

export interface ToolPlugin extends Disposable {
  id: ToolKey;
  label: string;
  available: boolean;
  activate(): void;
  deactivate(): void;
  openTool(): void;
}

export class ToolsManager implements Disposable {
  private toolsSettings: Partial<Record<ToolKey, boolean>> = {};
  private plugins: Map<ToolKey, ToolPlugin> = new Map();
  private activePlugins: Set<ToolPlugin> = new Set();

  public constructor(
    public readonly devtools: Devtools,
    private readonly eventEmitter: EventEmitter
  ) {
    this.toolsSettings = Object.assign({}, extensionContext.workspaceState.get(TOOLS_SETTINGS_KEY));

    for (const plugin of createExpoDevPluginTools(this)) {
      this.plugins.set(plugin.id, plugin);
    }

    this.plugins.set("network", new NetworkPlugin(devtools));

    this.handleStateChange();
  }

  public getPlugin(toolName: ToolKey): ToolPlugin | undefined {
    return this.plugins.get(toolName);
  }

  dispose() {
    this.activePlugins.forEach((plugin) => plugin.deactivate());
    this.activePlugins.clear();
    this.plugins.forEach((plugin) => plugin.dispose());
  }

  public handleStateChange() {
    for (const plugin of this.plugins.values()) {
      if (plugin.available) {
        const enabled = this.toolsSettings[plugin.id] || false;
        const active = this.activePlugins.has(plugin);
        if (active !== enabled) {
          if (enabled) {
            plugin.activate();
            this.activePlugins.add(plugin);
          } else {
            plugin.deactivate();
            this.activePlugins.delete(plugin);
          }
        }
      }
    }

    this.eventEmitter.emit("toolsStateChanged", this.getToolsState());
  }

  public getToolsState(): ToolsState {
    const toolsState: ToolsState = {};
    for (const [id, plugin] of this.plugins) {
      if (plugin.available) {
        toolsState[id] = {
          label: plugin.label,
          enabled: this.toolsSettings[id] || false,
        };
      }
    }
    return toolsState;
  }

  public updateToolEnabledState(toolName: ToolKey, enabled: boolean) {
    if (this.plugins.has(toolName)) {
      this.toolsSettings[toolName] = enabled;
      extensionContext.workspaceState.update(TOOLS_SETTINGS_KEY, this.toolsSettings);
      this.handleStateChange();
    }
  }

  public openTool(toolName: ToolKey) {
    const plugin = this.plugins.get(toolName);
    if (plugin && this.toolsSettings[toolName] && this.activePlugins.has(plugin)) {
      plugin.openTool();
    }
  }
}
