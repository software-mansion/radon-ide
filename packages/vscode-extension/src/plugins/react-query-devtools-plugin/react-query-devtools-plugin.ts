import { commands, window } from "vscode";
import { ToolPlugin } from "../../project/tools";
import { extensionContext } from "../../utilities/extensionContext";
import { ReactQueryDevToolsPluginWebviewProvider } from "./ReactQueryDevToolsPluginWebviewProvider";

export const REACT_QUERY_PLUGIN_ID = "react-query";
const REACT_QUERY_PLUGIN_PREFIX = "RNIDE.Tool.ReactQueryDevTools";

let initialzed = false;

function initialize() {
  if (initialzed) {
    return;
  }
  initialzed = true;

  extensionContext.subscriptions.push(
    window.registerWebviewViewProvider(
      `${REACT_QUERY_PLUGIN_PREFIX}.view`,
      new ReactQueryDevToolsPluginWebviewProvider(extensionContext),
      {
        webviewOptions: { retainContextWhenHidden: true },
      }
    )
  );
}

export const createReactQueryDevtools = (): ToolPlugin => {
  initialize();

  const plugin: ToolPlugin = {
    id: REACT_QUERY_PLUGIN_ID,
    label: "React Query DevTools",
    toolInstalled: false,
    pluginAvailable: true,
    persist: true,
    enable() {
      commands.executeCommand("setContext", `${REACT_QUERY_PLUGIN_PREFIX}.available`, true);
    },
    disable() {
      commands.executeCommand("setContext", `${REACT_QUERY_PLUGIN_PREFIX}.available`, false);
    },
    deactivate() {
      this.disable();
    },
    openTool() {
      commands.executeCommand(`${REACT_QUERY_PLUGIN_PREFIX}.view.focus`);
    },
    dispose() {},
  };

  return plugin;
};
