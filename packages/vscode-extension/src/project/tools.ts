import { EventEmitter } from "stream";
import { Disposable } from "vscode";
import _ from "lodash";
import { Devtools } from "./devtools";
import { extensionContext } from "../utilities/extensionContext";
import { ToolsState } from "../common/Project";
import {
  createExpoDevPluginTools,
  ExpoDevPluginToolName,
} from "../plugins/expo-dev-plugins/expo-dev-plugins";
import { NetworkPlugin, NETWORK_PLUGIN_ID } from "../plugins/network/network-plugin";
import {
  REDUX_PLUGIN_ID,
  createReduxDevtools,
} from "../plugins/redux-devtools-plugin/redux-devtools-plugin";
import { getTelemetryReporter } from "../utilities/telemetry";

const TOOLS_SETTINGS_KEY = "tools_settings";

export type ToolKey = ExpoDevPluginToolName | typeof NETWORK_PLUGIN_ID | typeof REDUX_PLUGIN_ID;

export interface ToolPlugin extends Disposable {
  id: ToolKey;
  label: string;
  available: boolean;
  persist: boolean;
  activate(): void;
  deactivate(): void;
  openTool?(): void;
}

export function reportToolVisibilityChanged(toolName: ToolKey, visible: boolean) {
  const visibility = visible ? "visible" : "hidden";
  getTelemetryReporter().sendTelemetryEvent(`tools:${toolName}:visibility:${visibility}`);
}

export function reportToolOpened(toolName: ToolKey) {
  getTelemetryReporter().sendTelemetryEvent(`tools:${toolName}:opened`);
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

    for (const plugin of createExpoDevPluginTools()) {
      this.plugins.set(plugin.id, plugin);
    }

    this.plugins.set(REDUX_PLUGIN_ID, createReduxDevtools(this));
    this.plugins.set(NETWORK_PLUGIN_ID, new NetworkPlugin(devtools));

    devtools.addListener(this.devtoolsListener);
    this.handleStateChange();
  }

  private devtoolsListener = (event: string, payload: any) => {
    if (event === "RNIDE_devtoolPluginsChanged") {
      // payload.plugins is a list of expo dev plugin names
      const availablePlugins = new Set(payload.plugins);
      let changed = false;
      this.plugins.forEach((plugin) => {
        if (!plugin.available && availablePlugins.has(plugin.id)) {
          changed = true;
          plugin.available = true;
        }
      });
      // notify tools manager that the state of requested plugins has changed
      changed && this.handleStateChange();
    }
  };

  public getPlugin(toolName: ToolKey): ToolPlugin | undefined {
    return this.plugins.get(toolName);
  }

  dispose() {
    this.activePlugins.forEach((plugin) => plugin.deactivate());
    this.activePlugins.clear();
    this.plugins.forEach((plugin) => plugin.dispose());
    this.devtools.removeListener(this.devtoolsListener);
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
          panelAvailable: plugin.openTool !== undefined,
        };
      }
    }
    return toolsState;
  }

  public updateToolEnabledState(toolName: ToolKey, enabled: boolean) {
    const plugin = this.plugins.get(toolName);
    if (plugin) {
      this.toolsSettings[toolName] = enabled;
      if (plugin.persist) {
        this.saveToolsState();
      }
      this.reportToolEnabled(toolName, enabled);
      this.handleStateChange();
    }
  }

  public openTool(toolName: ToolKey) {
    const plugin = this.plugins.get(toolName);
    if (plugin && this.toolsSettings[toolName] && this.activePlugins.has(plugin)) {
      plugin.openTool?.();
    }
  }

  private reportToolEnabled(toolName: ToolKey, enabled: boolean) {
    const enabledString = enabled ? "enabled" : "disabled";
    getTelemetryReporter().sendTelemetryEvent(`tools:${toolName}:${enabledString}`);
  }

  private saveToolsState() {
    const persistedToolsState = _.mapValues(this.toolsSettings, (value, key) => {
      return this.plugins.get(key as ToolKey)?.persist && value;
    });
    extensionContext.workspaceState.update(TOOLS_SETTINGS_KEY, persistedToolsState);
  }
}
