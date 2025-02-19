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

export const createReactQueryDevtools = (toolsManager: ToolsManager): ToolPlugin => {
  const webViewProvider = initializeReactQueryDevPlugin();

  let proxyDevtoolsListener: null | ((event: string, payload: any) => void) = null;
  webViewProvider?.setListener((webview) => {
    proxyDevtoolsListener = (event: string, payload: any) => {
      if (event === REACT_QUERY_PLUGIN_ID) {
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

      disposed = false;
    }
  }

  const plugin: ToolPlugin = {
    id: REACT_QUERY_PLUGIN_ID,
    label: "React Query DevTools",
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

  return plugin;
};
