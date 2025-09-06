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
import { PREVIEW_NETWORK_NAME, PREVIEW_NETWORK_PATH } from "../../webview/utilities/constants";

type WebviewMessage = Record<string, string> & {
  command: string;
};

export class NetworkDevtoolsWebviewProvider implements WebviewViewProvider {
  constructor(private readonly context: ExtensionContext) {}
  public resolveWebviewView(
    webviewView: WebviewView,
    context: WebviewViewResolveContext,
    token: CancellationToken
  ): void {
    reportToolOpened(NETWORK_PLUGIN_ID);
    const webview = webviewView.webview;
    webview.options = {
      enableScripts: true,
      localResourceRoots: [
        Uri.joinPath(this.context.extensionUri, "dist"),
        Uri.joinPath(this.context.extensionUri, "node_modules"),
      ],
    };

    const project = IDE.getInstanceIfExists()?.project;

    const networkPlugin = project?.deviceSession?.getPlugin("network") as NetworkPlugin | undefined;

    if (!networkPlugin) {
      throw new Error("Couldn't retrieve the network plugin");
    }

    // FIXME: Dispose
    const _disposable = webview.onDidReceiveMessage((event: WebviewMessage) => {
      if (event.command === "cdp-call") {
        networkPlugin.sendCDPMessage({
          method: event.method,
          params: {},
        });
      }
    });

    webviewView.onDidChangeVisibility(() =>
      reportToolVisibilityChanged(NETWORK_PLUGIN_ID, webviewView.visible)
    );

    webview.html = generateWebviewContent(
      this.context,
      webviewView.webview,
      this.context.extensionUri,
      PREVIEW_NETWORK_NAME,
      PREVIEW_NETWORK_PATH,
      `localhost:${networkPlugin.websocketPort}`
    );
  }
}
