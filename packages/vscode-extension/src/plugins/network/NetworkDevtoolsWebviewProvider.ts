import {
  CancellationToken,
  ExtensionContext,
  Uri,
  WebviewView,
  WebviewViewProvider,
  WebviewViewResolveContext,
} from "vscode";
import { IDE } from "../../project/ide";
import { NETWORK_PLUGIN_ID, NetworkPlugin } from "./network-plugin";
import { reportToolOpened, reportToolVisibilityChanged } from "../../project/tools";
import { generateWebviewContent } from "../../panels/webviewContentGenerator";
import {
  NETWORK_DEV_SERVER_HOST,
  PREVIEW_NETWORK_NAME,
  PREVIEW_NETWORK_PATH,
} from "../../webview/utilities/constants";

export class NetworkDevtoolsWebviewProvider implements WebviewViewProvider {
  constructor(private readonly context: ExtensionContext) {}
  public resolveWebviewView(
    webviewView: WebviewView,
    context: WebviewViewResolveContext,
    token: CancellationToken
  ): void {
    reportToolOpened(NETWORK_PLUGIN_ID);
    const webview = webviewView.webview;
    const baseUri = Uri.joinPath(this.context.extensionUri, "dist", "network-devtools-frontend");
    webview.options = {
      enableScripts: true,
      localResourceRoots: [baseUri],
    };

    const project = IDE.getInstanceIfExists()?.project;
    const wsPort = (project?.toolsManager.getPlugin("network") as NetworkPlugin)?.websocketPort;
    if (!wsPort) {
      throw new Error("Couldn't retrieve websocket port from network plugin");
    }

    webviewView.onDidChangeVisibility(() =>
      reportToolVisibilityChanged(NETWORK_PLUGIN_ID, webviewView.visible)
    );

    webview.html = generateWebviewContent(
      this.context,
      webviewView.webview,
      this.context.extensionUri,
      NETWORK_DEV_SERVER_HOST,
      PREVIEW_NETWORK_NAME,
      PREVIEW_NETWORK_PATH
    ).replace(
      "</body>",
      `<script>window.__websocketEndpoint = 'localhost:${wsPort}';</script></body>`
    );
  }
}
