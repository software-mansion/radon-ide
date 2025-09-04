import { Disposable } from "vscode";
import _ from "lodash";
import { NetworkInspectorBridge, RadonInspectorBridge } from "./bridge";
import { extensionContext } from "../utilities/extensionContext";
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
import { ToolsState } from "../common/State";
import { StateManager } from "./StateManager";
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
  toolInstalled: boolean;
  persist: boolean;
  pluginAvailable: boolean;
  pluginUnavailableTooltip?: string;
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
  private disposables: Disposable[] = [];

  public constructor(
    private readonly stateManager: StateManager<ToolsState>,
    public readonly inspectorBridge: RadonInspectorBridge,
    public readonly networkBridge: NetworkInspectorBridge
  ) {
    this.toolsSettings = Object.assign({}, extensionContext.workspaceState.get(TOOLS_SETTINGS_KEY));

    for (const plugin of createExpoDevPluginTools()) {
      this.plugins.set(plugin.id, plugin);
    }
    const reactQueryPlugin = createReactQueryDevtools();
    this.plugins.set(reactQueryPlugin.id, reactQueryPlugin);

    const handleRenderOutlinesAvailabilityChange = () => {
      // Note that this enables and disables the tool internally,
      // without updating the tool enabled state (calling updateToolEnabledState)
      // in order to avoid telemetry events spam and allow for storing the previous state
      // without refactoring the entire ToolsManager logic.

      // On the frontend, to determine whether tool is actually enabled, we have
      // to check the inspector availability (this.pluginAvailable) in cases where
      // it is unavailable, because getToolState() will return the active state from before
      // availability change.
      this.handleStateChange();
    };

    this.plugins.set(REDUX_PLUGIN_ID, new ReduxDevtoolsPlugin(inspectorBridge));
    this.plugins.set(NETWORK_PLUGIN_ID, new NetworkPlugin(inspectorBridge, networkBridge));
    this.plugins.set(
      RENDER_OUTLINES_PLUGIN_ID,
      new RenderOutlinesPlugin(inspectorBridge, handleRenderOutlinesAvailabilityChange)
    );

    this.disposables.push(
      inspectorBridge.onEvent("devtoolPluginsChanged", (payload) => {
        // payload.plugins is a list of expo dev plugin names
        const availablePlugins = new Set(payload.plugins);
        let changed = false;
        this.plugins.forEach((plugin) => {
          if (!plugin.toolInstalled && availablePlugins.has(plugin.id)) {
            changed = true;
            plugin.toolInstalled = true;
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
      if (plugin.toolInstalled) {
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

    this.setToolsState();
  }

  // TODO: we should consider using a more sophisticated approach to manage tool states
  private setToolsState() {
    const toolsState: ToolsState = {};
    for (const [id, plugin] of this.plugins) {
      if (plugin.toolInstalled) {
        toolsState[id] = {
          label: plugin.label,
          enabled: this.toolsSettings[id] || false,
          isPanelTool: plugin.openTool !== undefined,
          pluginAvailable: plugin.pluginAvailable,
          pluginUnavailableTooltip: plugin.pluginUnavailableTooltip,
        };
      }
    }

    this.stateManager.setState(toolsState);
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
