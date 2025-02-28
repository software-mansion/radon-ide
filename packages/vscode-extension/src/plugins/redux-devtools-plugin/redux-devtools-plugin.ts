import { commands, window, Disposable, WebviewView, Webview } from "vscode";
import { ToolKey, ToolPlugin, ToolsManager } from "../../project/tools";
import { extensionContext } from "../../utilities/extensionContext";
import { Devtools } from "../../project/devtools";
import { ReduxDevToolsPluginWebviewProvider } from "./ReduxDevToolsPluginWebviewProvider";

export const REDUX_PLUGIN_ID = "RNIDE-redux-devtools";
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

  constructor(private readonly devtools: Devtools) {
    initialize();
  }

  devtoolsListener = (event: string, payload: any) => {
    if (event === REDUX_PLUGIN_ID) {
      console.log("[WTF] PROXY DEVTOOLS LISTENER", event, payload);
      this.connectedWebview?.postMessage({
        scope: event,
        data: payload,
      });
    }
  };

  connectDevtoolsWebview(webview: Webview) {
    this.connectedWebview = webview;
    webview.onDidReceiveMessage((message) => {
      const { scope, ...data } = message;
      this.devtools.send(scope, data);
    });
  }

  activate() {
    commands.executeCommand("setContext", `${REDUX_PLUGIN_PREFIX}.available`, true);
    this.devtools.addListener(this.devtoolsListener);
  }

  deactivate() {
    this.devtools.removeListener(this.devtoolsListener);
    commands.executeCommand("setContext", `${REDUX_PLUGIN_PREFIX}.available`, false);
  }

  openTool() {
    commands.executeCommand(`${REDUX_PLUGIN_PREFIX}.view.focus`);
  }

  dispose() {
    this.devtools.removeListener(this.devtoolsListener);
  }
}
