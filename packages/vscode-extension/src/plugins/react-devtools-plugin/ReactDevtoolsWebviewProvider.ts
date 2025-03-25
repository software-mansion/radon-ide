import {
  CancellationToken,
  ExtensionContext,
  Uri,
  WebviewView,
  WebviewViewProvider,
  WebviewViewResolveContext,
} from "vscode";
import { IDE } from "../../project/ide";
import { reportToolOpened, reportToolVisibilityChanged } from "../../project/tools";
import { generateWebviewContent } from "../../panels/webviewContentGenerator";
import { REACT_DEVTOOLS_PLUGIN_ID, ReactDevtoolsPlugin } from "./react-devtools-plugin";

export class ReactDevtoolsWebviewProvider implements WebviewViewProvider {
  constructor(private readonly context: ExtensionContext) {}
  public resolveWebviewView(
    webviewView: WebviewView,
    context: WebviewViewResolveContext,
    token: CancellationToken
  ): void {
    reportToolOpened(REACT_DEVTOOLS_PLUGIN_ID);
    const webview = webviewView.webview;
    const baseUri = Uri.joinPath(this.context.extensionUri, "dist", "react-devtools-frontend");
    webview.options = {
      enableScripts: true,
      localResourceRoots: [baseUri],
    };

    const project = IDE.getInstanceIfExists()?.project;
    const wsPort = (project?.toolsManager.getPlugin("react-devtools") as ReactDevtoolsPlugin)
      ?.websocketPort;

    if (!wsPort) {
      throw new Error("Couldn't retrieve websocket port from react-devtools plugin");
    }

    webviewView.onDidChangeVisibility(() =>
      reportToolVisibilityChanged(REACT_DEVTOOLS_PLUGIN_ID, webviewView.visible)
    );

    webview.html = generateWebviewContent(
      this.context,
      webviewView.webview,
      this.context.extensionUri,
      "localhost:1410",
      "devtools",
      "/src/webview/react-devtools"
    ).replace(
      "</body>",
      `<script>window.__websocketEndpoint = 'localhost:${wsPort}';</script></body>`
    );
  }
}
