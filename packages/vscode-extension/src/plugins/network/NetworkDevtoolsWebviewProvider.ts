import {
  CancellationToken,
  ExtensionContext,
  Uri,
  WebviewView,
  WebviewViewProvider,
  WebviewViewResolveContext,
} from "vscode";
import { IDE } from "../../project/ide";
import { NetworkPlugin } from "./network-plugin";

export class NetworkDevtoolsWebviewProvider implements WebviewViewProvider {
  constructor(private readonly context: ExtensionContext) {}
  public resolveWebviewView(
    webviewView: WebviewView,
    context: WebviewViewResolveContext,
    token: CancellationToken
  ): void {
    const webview = webviewView.webview;
    const baseUri = Uri.joinPath(this.context.extensionUri, "dist", "network-devtools-frontend");
    webview.options = {
      enableScripts: true,
      localResourceRoots: [baseUri],
    };

    const project = IDE.getOrCreateInstance(this.context).project;
    const wsPort = (project.toolsManager.getPlugin("network") as NetworkPlugin)?.websocketPort;
    if (!wsPort) {
      throw new Error("Couldn't retrieve websocket port from network plugin");
    }

    const webviewBase = webview.asWebviewUri(baseUri);
    const inspectorJsUri = webview.asWebviewUri(
      Uri.joinPath(baseUri, "entrypoints", "inspector", "inspector.js")
    );

    webview.html = /* html */ `
    <!DOCTYPE html>
<html lang="en">
<base href="${webviewBase}">
<meta charset="utf-8">
<title>DevTools</title>
<style>
  @media (prefers-color-scheme: dark) {
    body {
      background-color: rgb(41 42 45);
    }
  }
</style>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} https:; connect-src ws://localhost:${wsPort} ${webview.cspSource}; script-src 'unsafe-inline' ${webview.cspSource}; style-src 'unsafe-inline' ${webview.cspSource};">
<meta name="referrer" content="no-referrer">
<script>
window.__websocketEndpoint = 'localhost:${wsPort}';
</script>
<script type="module" src="${inspectorJsUri}"></script>
<body class="undocked" id="-blink-dev-tools">`;
  }
}
