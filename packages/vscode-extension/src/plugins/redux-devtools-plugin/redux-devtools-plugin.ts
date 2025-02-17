import { commands, window, Disposable } from "vscode";
import { reportToolVisibilityChanged, ToolPlugin, ToolsManager } from "../../project/tools";
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
  let disposables: Disposable[] = [];
  let disposed = false;

  let proxyDevtoolsListener: null | ((event: string, payload: any) => void) = null;
  webViewProvider?.setListener((webview) => {
    if (disposed) {
      return;
    }
    proxyDevtoolsListener = (event: string, payload: any) => {
      if (event === REDUX_PLUGIN_ID) {
        webview.webview.postMessage({
          scope: event,
          data: payload,
        });
      }
    };

    toolsManager.devtools.addListener(proxyDevtoolsListener);

    disposables.push(
      webview.webview.onDidReceiveMessage((message) => {
        const { scope, ...data } = message;
        toolsManager.devtools.send(scope, data);
      })
    );
    disposables.push(
      webview.onDidChangeVisibility(() =>
        reportToolVisibilityChanged(REDUX_PLUGIN_ID, webview.visible)
      )
    );
  });

  function dispose() {
    if (!disposed) {
      if (proxyDevtoolsListener) {
        toolsManager.devtools.removeListener(proxyDevtoolsListener);
      }
      disposables.forEach((d) => d.dispose());
      disposables = [];
      disposed = true;
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

  return plugin;
};
