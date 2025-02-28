import { commands, window } from "vscode";
import { ExpoDevPluginWebviewProvider } from "./ExpoDevPluginWebviewProvider";
import { ToolPlugin } from "../../project/tools";
import { extensionContext } from "../../utilities/extensionContext";

export type ExpoDevPluginToolName =
  | "@dev-plugins/react-native-mmkv"
  | "redux-devtools-expo-dev-plugin";

type ExpoDevPluginInfo = {
  viewIdPrefix: string;
  label: string;
};

// Define the map of plugins using the string union type
const ExpoDevPluginToolMap: Record<ExpoDevPluginToolName, ExpoDevPluginInfo> = {
  "@dev-plugins/react-native-mmkv": {
    label: "MMKV DevPlugin",
    viewIdPrefix: "RNIDE.Tool.ExpoDevPlugin.MMKV",
  },
  "redux-devtools-expo-dev-plugin": {
    viewIdPrefix: "RNIDE.Tool.ExpoDevPlugin.ReduxDevTools",
    label: "Redux DevTools DevPlugin",
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

export function createExpoDevPluginTools(): ToolPlugin[] {
  initializeExpoDevPluginIfNeeded();

  const plugins: ToolPlugin[] = [];

  for (const [id, pluginInfo] of Object.entries(ExpoDevPluginToolMap)) {
    plugins.push({
      id: id as ExpoDevPluginToolName,
      label: pluginInfo.label,
      available: false,
      persist: true,
      activate() {
        commands.executeCommand("setContext", `${pluginInfo.viewIdPrefix}.available`, true);
      },
      deactivate() {
        commands.executeCommand("setContext", `${pluginInfo.viewIdPrefix}.available`, false);
      },
      openTool() {
        commands.executeCommand(`${pluginInfo.viewIdPrefix}.view.focus`);
      },
      dispose() {},
    });
  }

  return plugins;
}
