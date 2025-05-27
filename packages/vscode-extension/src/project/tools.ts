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
  ReduxDevtoolsPlugin,
} from "../plugins/redux-devtools-plugin/redux-devtools-plugin";
import {
  REACT_QUERY_PLUGIN_ID,
  createReactQueryDevtools,
} from "../plugins/react-query-devtools-plugin/react-query-devtools-plugin";
import { getTelemetryReporter } from "../utilities/telemetry";
import { RenderOutlinesPlugin } from "../plugins/render-outlines/render-outlines-plugin";
import { RENDER_OUTLINES_PLUGIN_ID } from "../common/RenderOutlines";
import { disposeAll } from "../utilities/disposables";
const TOOLS_SETTINGS_KEY = "tools_settings";

export type ToolKey =
  | ExpoDevPluginToolName
  | typeof REACT_QUERY_PLUGIN_ID
  | typeof NETWORK_PLUGIN_ID
  | typeof REDUX_PLUGIN_ID
  | typeof RENDER_OUTLINES_PLUGIN_ID;

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

export interface ToolsDelegate {
  onToolsStateChange(toolsState: ToolsState): void;
}

export class ToolsManager implements Disposable {
  private toolsSettings: Partial<Record<ToolKey, boolean>> = {};
  private plugins: Map<ToolKey, ToolPlugin> = new Map();
  private activePlugins: Set<ToolPlugin> = new Set();
  private disposables: Disposable[] = [];

  public constructor(
    public readonly devtools: Devtools,
    private readonly delegate: ToolsDelegate
  ) {
    this.toolsSettings = Object.assign({}, extensionContext.workspaceState.get(TOOLS_SETTINGS_KEY));

    for (const plugin of createExpoDevPluginTools()) {
      this.plugins.set(plugin.id, plugin);
    }
    const reactQueryPlugin = createReactQueryDevtools();
    this.plugins.set(reactQueryPlugin.id, reactQueryPlugin);

    this.plugins.set(REDUX_PLUGIN_ID, new ReduxDevtoolsPlugin(devtools));
    this.plugins.set(NETWORK_PLUGIN_ID, new NetworkPlugin(devtools));
    this.plugins.set(RENDER_OUTLINES_PLUGIN_ID, new RenderOutlinesPlugin(devtools));

    this.disposables.push(
      devtools.onEvent("RNIDE_devtoolPluginsChanged", (payload) => {
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
        if (changed) {
          this.handleStateChange();
        }
      })
    );
  }

  public getPlugin(toolName: ToolKey): ToolPlugin | undefined {
    return this.plugins.get(toolName);
  }

  dispose() {
    this.activePlugins.forEach((plugin) => plugin.deactivate());
    this.activePlugins.clear();
    this.plugins.forEach((plugin) => plugin.dispose());
    disposeAll(this.disposables);
  }

  public deactivate() {
    this.activePlugins.forEach((plugin) => plugin.deactivate());
  }

  public activate() {
    this.activePlugins.forEach((plugin) => plugin.activate());
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

    this.delegate.onToolsStateChange(this.getToolsState());
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
