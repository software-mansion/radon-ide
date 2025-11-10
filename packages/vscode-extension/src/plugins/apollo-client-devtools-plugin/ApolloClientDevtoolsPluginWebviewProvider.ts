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
import { APOLLO_PLUGIN_ID, ApolloClientDevtoolsPlugin } from "./apollo-client-devtools-plugin";
import { reportToolOpened, reportToolVisibilityChanged } from "../../project/tools";
import { IDE } from "../../project/ide";

const PATH = "dist/apollo-client/";

const prepareWebviewJS = (files: string[], nonce: string) => {
  return files
    .map((file) => {
      return /*html*/ `<script src="${file}" nonce="${nonce}" defer></script>`;
    })
    .join("\n");
};

function generateWebviewContent(
  context: ExtensionContext,
  webview: Webview,
  extensionUri: Uri
): string {
  const nonce = getNonce();
  const baseUri = getUri(webview, extensionUri, [PATH]);
  const jsImports = prepareWebviewJS(
    ["chrome-api-stub.webview.js", "devtools.js", "panel.js"],
    nonce
  );

  return /*html*/ `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <base href="${baseUri}">
        <meta charset="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <title>apollo-client</title>
        <meta http-equiv="Content-Security-Policy"
        content="default-src 'none';
        img-src vscode-resource: http: https: data:;
        media-src vscode-resource: http: https:;
        style-src ${webview.cspSource} 'unsafe-inline';
        script-src 'nonce-${nonce}';
        font-src vscode-resource: https:;"
        />
        <style>
        html,
        body {
            overflow: hidden;
        }
        :root {
            font-size: 16px;
        }
        ::-webkit-scrollbar {
            display: none;
        }
        #devtools {
            width: 100vw;
            height: 100vh;
        }
        </style>
    </head>

    <body class="text-primary dark:text-primary-dark">
        <div id="devtools"></div>
        ${jsImports}
    </body>
    </html>
  `;
}

export class ApolloClientDevtoolsPluginWebviewProvider implements WebviewViewProvider {
  constructor(private readonly context: ExtensionContext) {}

  public resolveWebviewView(
    webviewView: WebviewView,
    context: WebviewViewResolveContext,
    token: CancellationToken
  ): void {
    reportToolOpened(APOLLO_PLUGIN_ID);
    const webview = webviewView.webview;
    webview.options = {
      enableScripts: true,
      localResourceRoots: [Uri.joinPath(this.context.extensionUri, PATH)],
    };

    const project = IDE.getInstanceIfExists()?.project;
    const apolloClientPlugin = project?.deviceSession?.getPlugin(
      APOLLO_PLUGIN_ID
    ) as ApolloClientDevtoolsPlugin;
    if (!apolloClientPlugin) {
      throw new Error("Couldn't find apollo client plugin");
    }

    apolloClientPlugin.connectDevtoolsWebview(webview);
    webviewView.onDidDispose(() => {
      apolloClientPlugin.disconnectDevtoolsWebview(webview);
    });

    webviewView.onDidChangeVisibility(() => {
      reportToolVisibilityChanged(APOLLO_PLUGIN_ID, webviewView.visible);
    });

    webview.html = generateWebviewContent(
      extensionContext,
      webviewView.webview,
      extensionContext.extensionUri
    );
  }
}
