import {
  CancellationToken,
  ExtensionContext,
  Uri,
  Webview,
  WebviewView,
  WebviewViewProvider,
  WebviewViewResolveContext,
} from "vscode";
import { extensionContext } from "../../utilities/extensionContext";
import { getUri } from "../../utilities/getUri";
import { getNonce } from "../../utilities/getNonce";
import { IDE } from "../../project/ide";
import { REACT_QUERY_PLUGIN_ID } from "./react-query-devtools-plugin";
import { reportToolOpened, reportToolVisibilityChanged } from "../../project/tools";

const PATH = "dist/react-query-devtools/assets/";

function generateWebviewContent(
  context: ExtensionContext,
  webview: Webview,
  extensionUri: Uri
): string {
  const nonce = getNonce();
  const baseUri = getUri(webview, extensionUri, [PATH]);

  return /*html*/ `
    <!doctype html>
    <html lang="en">
      <head>
        <base href="${baseUri}">
        <meta charset="UTF-8" />
        <title>React Query DevTools</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta http-equiv="Content-Security-Policy"
          content="default-src 'none';
          img-src vscode-resource: http: https: data:;
          media-src vscode-resource: http: https:;
          style-src ${webview.cspSource} 'unsafe-inline';
          script-src 'nonce-${nonce}';
          font-src vscode-resource: https:;" 
        />
        <script type="module" nonce="${nonce}" src="index.js"></script>
        <style>
          body {
            padding: 0;
            display: block;
          }

          #app {
            padding: 0;
            height: 100vh!important;
          }

          .tsqd-text-logo-container {
            display: none!important;
          }

          .tsqd-action-mock-offline-behavior {
            display: none!important;
          }
        </style>
      </head>
      <body>
        <div id="app"></div>
      </body>
    </html>
  `;
}

export class ReactQueryDevToolsPluginWebviewProvider implements WebviewViewProvider {
  constructor(private readonly context: ExtensionContext) {}

  public resolveWebviewView(
    webviewView: WebviewView,
    context: WebviewViewResolveContext,
    token: CancellationToken
  ): void {
    reportToolOpened(REACT_QUERY_PLUGIN_ID);

    const webview = webviewView.webview;

    webview.options = {
      enableScripts: true,
      localResourceRoots: [Uri.joinPath(this.context.extensionUri, PATH)],
    };

    webview.html = generateWebviewContent(extensionContext, webview, extensionContext.extensionUri);

    const devTools = IDE.getInstanceIfExists()?.project?.deviceSession?.toolsManager.devtools;

    const handleDevToolsMessage = (event: string, payload: any) => {
      if (event === REACT_QUERY_PLUGIN_ID) {
        webview.postMessage({
          scope: event,
          data: payload,
        });
      }
    };

    devTools?.addListener(handleDevToolsMessage);

    webview.onDidReceiveMessage((message) => {
      const { scope, ...data } = message;
      devTools?.send(scope, data);
    });

    webviewView.onDidChangeVisibility(() => {
      reportToolVisibilityChanged(REACT_QUERY_PLUGIN_ID, webviewView.visible);
    });

    webviewView.onDidDispose(() => {
      devTools?.removeListener(handleDevToolsMessage);
    });
  }
}
