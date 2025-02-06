import { commands, window } from "vscode";
import { ToolPlugin, ToolsManager } from "../../project/tools";
import { extensionContext } from "../../utilities/extensionContext";
import { ReactQueryDevToolsPluginWebviewProvider } from "./ReactQueryDevToolsPluginWebviewProvider";

export const REACT_QUERY_PLUGIN_ID = "RNIDE-react-query-devtools";
const REACT_QUERY_PLUGIN_PREFIX = "RNIDE.Tool.ReactQueryDevTools";

let initialzed = false;

function initializeReactQueryDevPlugin() {
  if (initialzed) {
    return;
  }
  initialzed = true;

  const webviewProvider = new ReactQueryDevToolsPluginWebviewProvider(extensionContext);

  extensionContext.subscriptions.push(
    window.registerWebviewViewProvider(`${REACT_QUERY_PLUGIN_PREFIX}.view`, webviewProvider, {
      webviewOptions: { retainContextWhenHidden: true },
    })
  );

  return webviewProvider;
}

export const createREACT_QUERYDevtools = (toolsManager: ToolsManager): ToolPlugin => {
  const webViewProvider = initializeReactQueryDevPlugin();

  // function devtoolsListener(event: string, payload: any) {
  //   if (event === "RNIDE_pluginsChanged") {
  //     const availablePlugins = new Set(payload.plugins);
  //     plugin.available = availablePlugins.has(plugin.id);
  //     toolsManager.handleStateChange();
  //   }
  // }

  let proxyDevtoolsListener: null | ((event: string, payload: any) => void) = null;
  webViewProvider?.setListener((webview) => {
    proxyDevtoolsListener = (event: string, payload: any) => {
      console.log("DEVTOOLS EVENT", event);
      if (event === REACT_QUERY_PLUGIN_ID) {
        console.log("DEVTOOLS PAYLOAD 2", payload);
        webview.webview.postMessage({
          scope: event,
          data: payload,
        });
      }
    };

    toolsManager.devtools.addListener(proxyDevtoolsListener);

    webview.webview.onDidReceiveMessage((message) => {
      const { scope, ...data } = message;
      toolsManager.devtools.send(scope, data);
    });
  });

  let disposed = false;
  function dispose() {
    if (!disposed) {
      if (proxyDevtoolsListener) {
        toolsManager.devtools.removeListener(proxyDevtoolsListener);
      }

      // toolsManager.devtools.removeListener(devtoolsListener);
      disposed = false;
    }
  }

  const plugin: ToolPlugin = {
    id: REACT_QUERY_PLUGIN_ID,
    label: "REACT_QUERY DevTools",
    available: true,
    activate() {
      commands.executeCommand("setContext", `${REACT_QUERY_PLUGIN_PREFIX}.available`, true);
    },
    deactivate() {
      commands.executeCommand("setContext", `${REACT_QUERY_PLUGIN_PREFIX}.available`, false);
    },
    openTool() {
      commands.executeCommand(`${REACT_QUERY_PLUGIN_PREFIX}.view.focus`);
    },
    dispose,
  };

  // Listen for events passed via devtools that indicate which plugins are loaded
  // by the app.
  // toolsManager.devtools.addListener(devtoolsListener);

  return plugin;
};
