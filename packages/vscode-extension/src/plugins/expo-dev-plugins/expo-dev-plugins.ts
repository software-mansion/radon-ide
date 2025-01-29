import { commands, window } from "vscode";
import { ExpoDevPluginWebviewProvider } from "./ExpoDevPluginWebviewProvider";
import { ToolPlugin, ToolsManager } from "../../project/tools";
import { extensionContext } from "../../utilities/extensionContext";

export type ExpoDevPluginToolName =
  | "@dev-plugins/react-query"
  | "@dev-plugins/react-native-mmkv"
  | "redux-devtools-expo-dev-plugin";

type ExpoDevPluginInfo = {
  viewIdPrefix: string;
  label: string;
};

// Define the map of plugins using the string union type
const ExpoDevPluginToolMap: Record<ExpoDevPluginToolName, ExpoDevPluginInfo> = {
  "@dev-plugins/react-query": {
    label: "React Query",
    viewIdPrefix: "RNIDE.Tool.ExpoDevPlugin.ReactQuery",
  },
  "@dev-plugins/react-native-mmkv": {
    label: "MMKV",
    viewIdPrefix: "RNIDE.Tool.ExpoDevPlugin.MMKV",
  },
  "redux-devtools-expo-dev-plugin": {
    viewIdPrefix: "RNIDE.Tool.ExpoDevPlugin.ReduxDevTools",
    label: "Redux DevTools",
  },
};


let initialzed = false;
function initializeExpoDevPluginIfNeeded() {
  if (initialzed) {
    return;
  }
  initialzed = true;

  for (const [name, pluginInfo] of Object.entries(ExpoDevPluginToolMap)) {
    extensionContext.subscriptions.push(
      window.registerWebviewViewProvider(
        `${pluginInfo.viewIdPrefix}.view`,
        new ExpoDevPluginWebviewProvider(extensionContext, name as ExpoDevPluginToolName),
        { webviewOptions: { retainContextWhenHidden: true } }
      )
    );
  }
}

export function createExpoDevPluginTools(toolsManager: ToolsManager): ToolPlugin[] {
  initializeExpoDevPluginIfNeeded();

  const plugins: ToolPlugin[] = [];

  function devtoolsListener(event: string, payload: any) {
    if (event === "RNIDE_expoDevPluginsChanged") {
      // payload.plugins is a list of expo dev plugin names
      const availablePlugins = new Set(payload.plugins);
      for (const plugin of plugins) {
        plugin.available = availablePlugins.has(plugin.id);
      }
      // notify tools manager that the state of requested plugins has changed
      toolsManager.handleStateChange();
    }
  }
  let disposed = false;
  function dispose() {
    if (!disposed) {
      toolsManager.devtools.removeListener(devtoolsListener);
      disposed = false;
    }
  }

  for (const [id, pluginInfo] of Object.entries(ExpoDevPluginToolMap)) {
    plugins.push({
      id: id as ExpoDevPluginToolName,
      label: pluginInfo.label,
      available: false,
      activate() {
        commands.executeCommand("setContext", `${pluginInfo.viewIdPrefix}.available`, true);
      },
      deactivate() {
        commands.executeCommand("setContext", `${pluginInfo.viewIdPrefix}.available`, false);
      },
      openTool() {
        commands.executeCommand(`${pluginInfo.viewIdPrefix}.view.focus`);
      },
      dispose,
    });
  }

  // Listen for events passed via devtools that indicate which plugins are loaded
  // by the app.
  toolsManager.devtools.addListener(devtoolsListener);

  return plugins;
}
