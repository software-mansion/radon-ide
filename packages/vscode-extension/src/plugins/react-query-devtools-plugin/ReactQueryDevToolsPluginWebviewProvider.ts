import fs from "fs";
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

const PATH = "plugins_dist/react-query/";

const prepareWebviewCSS = (files: string[]) => {
  return files
    .map((file) => {
      return /*html*/ `
      <link rel="preload" href="${file}" as="style">
      <link rel="stylesheet" href="${file}">
    `;
    })
    .join("\n");
};

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
  const files = fs.readdirSync(baseUri.path, { recursive: true });
  const cssFiles = files
    .filter((file) => typeof file === "string")
    .filter((file) => file.endsWith(".css"));
  const jsFiles = files
    .filter((file) => typeof file === "string")
    .filter((file) => file.endsWith(".js"));
  const cssImports = prepareWebviewCSS(cssFiles);
  const jsImports = prepareWebviewJS(jsFiles, nonce);

  return /*html*/ `
    <!DOCTYPE html>
      <html lang="en">
        <head>
          <base href="${baseUri}">
          <meta charset="utf-8" />
          <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
          <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
          <title>redux-devtools-expo-dev-plugin-webui</title>
          <!-- The react-native-web recommended style reset: https://necolas.github.io/react-native-web/docs/setup/#root-element -->
          <style id="expo-reset">
            /* These styles make the body full-height */
            html,
            body {
              height: 100%;
            }
            /* These styles disable body scrolling if you are using <ScrollView> */
            body {
              overflow: hidden;
            }
            /* These styles make the root element full-height */
            #root {
              display: flex;
              height: 100%;
              flex: 1;
            }
          </style>
          <meta http-equiv="Content-Security-Policy"
            content="default-src 'none';
            img-src vscode-resource: http: https: data:;
            media-src vscode-resource: http: https:;
            style-src ${webview.cspSource} 'unsafe-inline';
            script-src 'nonce-${nonce}';
            font-src vscode-resource: https:;" 
          />
          ${cssImports}
        </head>

        <body>
          <!-- Use static rendering with Expo Router to support running without JavaScript. -->
          <noscript>
            You need to enable JavaScript to run this app.
          </noscript>
          <!-- The root element for your Expo app. -->
          <div id="root"></div>
          ${jsImports}
      </body>
      </html>
  `;
}

export class ReactQueryDevToolsPluginWebviewProvider implements WebviewViewProvider {
  constructor(private readonly context: ExtensionContext) {}

  cb?: (webview: WebviewView) => void;

  public resolveWebviewView(
    webviewView: WebviewView,
    context: WebviewViewResolveContext,
    token: CancellationToken
  ): void {
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [Uri.joinPath(this.context.extensionUri, PATH)],
    };

    webviewView.webview.html = generateWebviewContent(
      extensionContext,
      webviewView.webview,
      extensionContext.extensionUri
    );

    this.cb?.(webviewView);
  }

  setListener(cb: (webview: WebviewView) => void) {
    this.cb = cb;
  }
}
