import { commands, window, Webview, Disposable } from "vscode";
import { uniqueId } from "lodash";
import { ToolKey, ToolPlugin } from "../../project/tools";
import { extensionContext } from "../../utilities/extensionContext";
import { RadonInspectorBridge } from "../../project/inspectorBridge";
import { ReduxDevToolsPluginWebviewProvider } from "./ReduxDevToolsPluginWebviewProvider";
import { disposeAll } from "../../utilities/disposables";
import { addConnection } from "./background.bundle";

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

function createChromePort(name: string, onMessage: (message: unknown) => void) {
  const messageListeners: ((message: unknown) => void)[] = [];
  const disconnectListeners: (() => void)[] = [];
  const connection = {
    name,
    postMessage: onMessage,
    onMessage: {
      addListener(listener: (message: unknown) => void) {
        messageListeners.push(listener);
      },
      removeListener(listener: (message: unknown) => void) {
        messageListeners.splice(messageListeners.indexOf(listener), 1);
      },
    },
    onDisconnect: {
      addListener(listener: () => void) {
        disconnectListeners.push(listener);
      },
      removeListener(listener: () => void) {
        disconnectListeners.splice(disconnectListeners.indexOf(listener), 1);
      },
    },
    sender: {
      id: uniqueId(),
    },
  };
  function postMessage(message: unknown) {
    messageListeners.slice().forEach((listener) => listener(message));
  }
  function disconnect() {
    disconnectListeners.slice().forEach((listener) => listener());
    messageListeners.length = 0;
  }
  return { connection, postMessage, disconnect };
}

export class ReduxDevtoolsPlugin implements ToolPlugin {
  public readonly id: ToolKey = REDUX_PLUGIN_ID;
  public readonly label = "Redux DevTools";

  public pluginAvailable = true;
  public toolInstalled = false;
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
    const { connection, postMessage, disconnect } = createChromePort("monitor", (message) =>
      this.connectedWebview?.postMessage(message)
    );
    addConnection(connection);
    const connectedWebviewListener = webview.onDidReceiveMessage((message) => {
      postMessage(message);
    });
    this.connectedWebviewListener = new Disposable(() => {
      disconnect();
      connectedWebviewListener.dispose();
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
    const { connection, postMessage, disconnect } = createChromePort("tab", (message) => {
      this.inspectorBridge.sendPluginMessage(REDUX_PLUGIN_ID, "chrome", message);
    });

    this.devtoolsListeners.push(new Disposable(disconnect));
    this.devtoolsListeners.push(
      this.inspectorBridge.onEvent("pluginMessage", ({ pluginId, type, data }) => {
        if (pluginId === REDUX_PLUGIN_ID) {
          postMessage(data);
        }
      })
    );
    addConnection(connection);
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
