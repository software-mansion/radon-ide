import { commands, window } from "vscode";
import { ToolPlugin, ToolsManager } from "../../project/tools";
import { extensionContext } from "../../utilities/extensionContext";
import { ReduxDevToolsPluginWebviewProvider } from "./ReduxDevToolsPluginWebviewProvider";

export const REDUX_PLUGIN_ID = "RNIDE-redux-devtools";
const REDUX_PLUGIN_PREFIX = "RNIDE.Tool.ReduxDevTools";

let initialzed = false;

function initializeReduxDevPlugin() {
  if (initialzed) {
    return;
  }
  initialzed = true;

  const webviewProvider = new ReduxDevToolsPluginWebviewProvider(extensionContext);

  extensionContext.subscriptions.push(
    window.registerWebviewViewProvider(`${REDUX_PLUGIN_PREFIX}.view`, webviewProvider, {
      webviewOptions: { retainContextWhenHidden: true },
    })
  );

  return webviewProvider;
}

export const createReduxDevtools = (toolsManager: ToolsManager): ToolPlugin => {
  const webViewProvider = initializeReduxDevPlugin();

  function devtoolsListener(event: string, payload: any) {
    if (event === "RNIDE_pluginsChanged") {
      const availablePlugins = new Set(payload.plugins);
      plugin.available = availablePlugins.has(plugin.id);;
      toolsManager.handleStateChange();
    }
  }
  
  let proxyDevtoolsListener: null | ((event: string, payload: any)=> void) = null;
  webViewProvider?.setListener((webview) => {
    proxyDevtoolsListener = (event: string, payload: any) => {
      if (event === REDUX_PLUGIN_ID) {
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
        toolsManager.devtools.removeListener(devtoolsListener);
      }

      toolsManager.devtools.removeListener(devtoolsListener);
      disposed = false;
    }
  }

  const plugin: ToolPlugin = {
    id: REDUX_PLUGIN_ID,
    label: "Redux DevTools",
    available: false,
    activate() {
      commands.executeCommand("setContext", `${REDUX_PLUGIN_PREFIX}.available`, true);
    },
    deactivate() {
      commands.executeCommand("setContext", `${REDUX_PLUGIN_PREFIX}.available`, false);
    },
    openTool() {
      commands.executeCommand(`${REDUX_PLUGIN_PREFIX}.view.focus`);
    },
    dispose,
  };

  // Listen for events passed via devtools that indicate which plugins are loaded
  // by the app.
  toolsManager.devtools.addListener(devtoolsListener);
  
  return plugin;
};
