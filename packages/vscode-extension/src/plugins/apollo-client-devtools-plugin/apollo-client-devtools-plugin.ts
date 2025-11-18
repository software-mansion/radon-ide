import { commands, window, Webview, Disposable } from "vscode";
import { ToolKey, ToolPlugin } from "../../project/tools";
import { extensionContext } from "../../utilities/extensionContext";
import { RadonInspectorBridge } from "../../project/inspectorBridge";
import { disposeAll } from "../../utilities/disposables";
import { addConnection } from "./background.bundle";
import { ApolloClientDevtoolsPluginWebviewProvider } from "./ApolloClientDevtoolsPluginWebviewProvider";

export const APOLLO_PLUGIN_ID = "apollo-client-devtools";

const APOLLO_PLUGIN_PREFIX = "RNIDE.Tool.ApolloClient";

const TAB_ID = "1";

let initialzed = false;

function initialize() {
  if (initialzed) {
    return;
  }
  initialzed = true;
  extensionContext.subscriptions.push(
    window.registerWebviewViewProvider(
      `${APOLLO_PLUGIN_PREFIX}.view`,
      new ApolloClientDevtoolsPluginWebviewProvider(extensionContext),
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
      tab: { id: TAB_ID },
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

export class ApolloClientDevtoolsPlugin implements ToolPlugin {
  public readonly id: ToolKey = APOLLO_PLUGIN_ID;
  public readonly label = "Apollo Client";

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
    const { connection, postMessage, disconnect } = createChromePort(TAB_ID, (message) =>
      this.connectedWebview?.postMessage({ scope: "rnide-chrome-stub", message })
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

  enable() {
    commands.executeCommand("setContext", `${APOLLO_PLUGIN_PREFIX}.available`, true);
    const { connection, postMessage, disconnect } = createChromePort("tab", (message) => {
      this.inspectorBridge.sendPluginMessage(APOLLO_PLUGIN_ID, "chrome", message);
    });

    this.devtoolsListeners.push(new Disposable(disconnect));
    this.devtoolsListeners.push(
      this.inspectorBridge.onEvent("pluginMessage", ({ pluginId, type, data }) => {
        if (pluginId === APOLLO_PLUGIN_ID) {
          postMessage(data);
        }
      })
    );
    addConnection(connection);
  }

  disable() {
    disposeAll(this.devtoolsListeners);
    commands.executeCommand("setContext", `${APOLLO_PLUGIN_PREFIX}.available`, false);
  }

  activate() {
    this.enable();
  }

  deactivate() {
    this.disable();
  }

  openTool() {
    commands.executeCommand(`${APOLLO_PLUGIN_PREFIX}.view.focus`);
  }

  dispose() {
    disposeAll(this.devtoolsListeners);
  }
}
