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

function generateWebviewContent(pluginName: ExpoDevPluginToolName, metroPort: number): string {
  const iframeURL = `http://localhost:${metroPort}/_expo/plugins/${pluginName}`;
  return /*html*/ `
    <!DOCTYPE html>
    <html style="height: 100%;">
      <head/>
      <body style="height: 100%;">
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
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [Uri.joinPath(this.context.extensionUri, "dist")],
    };

    const project = IDE.getOrCreateInstance(this.context).project;
    let metroPort: number | undefined;

    const projectStateListener = () => {
      let currentMetroPort = project.metro.port;
      if (currentMetroPort && metroPort !== currentMetroPort) {
        metroPort = currentMetroPort;
        webviewView.webview.html = generateWebviewContent(this.pluginName, metroPort);
      }
    };
    webviewView.onDidDispose(() => {
      project.removeListener("projectStateChanged", projectStateListener);
    });

    project.addListener("projectStateChanged", projectStateListener);
    project.getProjectState().then(projectStateListener);
  }
}
