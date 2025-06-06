import { commands, window, Webview, Disposable } from "vscode";
import { ToolKey, ToolPlugin } from "../../project/tools";
import { extensionContext } from "../../utilities/extensionContext";
import { RadonInspectorBridge } from "../../project/bridge";
import { ReduxDevToolsPluginWebviewProvider } from "./ReduxDevToolsPluginWebviewProvider";
import { disposeAll } from "../../utilities/disposables";

export const REDUX_PLUGIN_ID = "redux-devtools";
const REDUX_PLUGIN_PREFIX = "RNIDE.Tool.ReduxDevTools";

let initialzed = false;

function initialize() {
  if (initialzed) {
    return;
  }
  initialzed = true;
  extensionContext.subscriptions.push(
    window.registerWebviewViewProvider(
      `${REDUX_PLUGIN_PREFIX}.view`,
      new ReduxDevToolsPluginWebviewProvider(extensionContext),
      { webviewOptions: { retainContextWhenHidden: true } }
    )
  );
}

export class ReduxDevtoolsPlugin implements ToolPlugin {
  public readonly id: ToolKey = REDUX_PLUGIN_ID;
  public readonly label = "Redux DevTools";

  public available = false;
  public readonly persist = true;

  private connectedWebview?: Webview;
  private connectedWebviewListener?: Disposable;
  private devtoolsListeners: Disposable[] = [];

  constructor(private readonly inspectorBridge: RadonInspectorBridge) {
    initialize();
  }

  connectDevtoolsWebview(webview: Webview) {
    this.connectedWebviewListener?.dispose();
    this.connectedWebview = webview;
    this.connectedWebviewListener = webview.onDidReceiveMessage((message) => {
      this.inspectorBridge.sendPluginMessage(REDUX_PLUGIN_ID, message.type, message.data);
    });
  }

  disconnectDevtoolsWebview(webview: Webview) {
    if (this.connectedWebview === webview) {
      this.connectedWebview = undefined;
      this.connectedWebviewListener?.dispose();
    }
  }

  activate() {
    commands.executeCommand("setContext", `${REDUX_PLUGIN_PREFIX}.available`, true);
    this.devtoolsListeners.push(
      this.inspectorBridge.onEvent("pluginMessage", ({ pluginId, type, data }) => {
        if (pluginId === REDUX_PLUGIN_ID) {
          this.connectedWebview?.postMessage({
            scope: "RNIDE-redux-devtools",
            data: {
              type,
              data,
            },
          });
        }
      })
    );
    this.devtoolsListeners.push(
      this.inspectorBridge.onEvent("appReady", () => {
        // Sometimes, the messaging channel (devtools) is established only after
        // the Redux store is created and after it sends the first message. In that
        // case, the "start" event never makes it to the webview.
        // To workaround this, we use "appReady" event which is sent after the messaging
        // channel is established. We then force reload the webview with redux devtools
        // which causes the devtools to initialize a new session and, as a consequence force the store
        // to reconnect.
        if (this.connectedWebview) {
          const html = this.connectedWebview.html;
          this.connectedWebview.html = "";
          this.connectedWebview.html = html;
        }
      })
    );
  }

  deactivate() {
    disposeAll(this.devtoolsListeners);
    commands.executeCommand("setContext", `${REDUX_PLUGIN_PREFIX}.available`, false);
  }

  openTool() {
    commands.executeCommand(`${REDUX_PLUGIN_PREFIX}.view.focus`);
  }

  dispose() {
    disposeAll(this.devtoolsListeners);
  }
}
