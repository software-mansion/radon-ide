import {
  CancellationToken,
  ExtensionContext,
  Uri,
  WebviewView,
  WebviewViewProvider,
  WebviewViewResolveContext,
} from "vscode";
import { IDE } from "../../project/ide";
import { ExpoDevPluginToolName } from "./expo-dev-plugins";
import { Logger } from "../../Logger";
import { reportToolOpened, reportToolVisibilityChanged } from "../../project/tools";

function generateWebviewContent(pluginName: ExpoDevPluginToolName, metroPort: number): string {
  const iframeURL = `http://localhost:${metroPort}/_expo/plugins/${pluginName}`;
  return /*html*/ `
    <!DOCTYPE html>
    <html style="height: 100%;">
      <head/>
      <body style="height: 100%; overflow:hidden">
        <iframe src="${iframeURL}" style="width: 100%; height: 100%; border: none;"/>
      </body>
    </html>
  `;
}

export class ExpoDevPluginWebviewProvider implements WebviewViewProvider {
  constructor(
    private readonly context: ExtensionContext,
    private readonly pluginName: ExpoDevPluginToolName
  ) {}
  public resolveWebviewView(
    webviewView: WebviewView,
    context: WebviewViewResolveContext,
    token: CancellationToken
  ): void {
    reportToolOpened(this.pluginName);
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [Uri.joinPath(this.context.extensionUri, "dist")],
    };

    webviewView.onDidChangeVisibility(() =>
      reportToolVisibilityChanged(this.pluginName, webviewView.visible)
    );

    const metroPort = IDE.getInstanceIfExists()?.project.metro.port;
    if (!metroPort) {
      Logger.error(
        "Metro port is unknown while expected to be set, the devtools panel cannot be opened."
      );
    } else {
      webviewView.webview.html = generateWebviewContent(this.pluginName, metroPort);
    }
  }
}
