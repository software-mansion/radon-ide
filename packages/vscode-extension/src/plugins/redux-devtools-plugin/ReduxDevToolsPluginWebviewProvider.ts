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


// <meta http-equiv="Content-Security-Policy"
//               content="default-src 'none';
//                       img-src vscode-resource: http: https: data:;
//                       media-src vscode-resource: http: https:;
//                       style-src ${webview.cspSource} 'unsafe-inline';
//                       script-src 'nonce-${nonce}';
//                       font-src vscode-resource: https:;" />

function generateWebviewContent(
  context: ExtensionContext,
  webview: Webview,
  extensionUri: Uri
): string {
  const baseUri = getUri(webview, extensionUri, ["dist/plugins/redux"]);
   // const baseUri = Uri.joinPath(extensionUri, "dist/plugins/redux");

// const nonce = getNonce();
   
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
        
          <link rel="preload" href="./redux/css/index-8f30c04047bae6699f82f40acebe1aed.css" as="style">
          <link rel="stylesheet" href="./redux/css/index-8f30c04047bae6699f82f40acebe1aed.css">
          <link rel="preload" href="./redux/css/codemirror-46292010b15a8ba62a25f29c89e1e049.css" as="style">
          <link rel="stylesheet" href="./redux/css/codemirror-46292010b15a8ba62a25f29c89e1e049.css">
          <link rel="preload" href="./redux/css/foldgutter-1f00b44a780329dcb1a9cb6f53c74899.css" as="style">
          <link rel="stylesheet" href="./redux/css/foldgutter-1f00b44a780329dcb1a9cb6f53c74899.css"></head>

        <body>
          <!-- Use static rendering with Expo Router to support running without JavaScript. -->
          <noscript>
            You need to enable JavaScript to run this app.
          </noscript>
          <!-- The root element for your Expo app. -->
          <div id="root"></div>
        <script src="./redux/js/AppEntry-9f5185ef27313606ee5279432a7a2e89.js" defer></script>
      </body>
      </html>

  `;
}

export class ReduxDevToolsPluginWebviewProvider implements WebviewViewProvider {
  constructor(private readonly context: ExtensionContext) {}

  cb?: (webview: WebviewView) => void;

  public resolveWebviewView(
    webviewView: WebviewView,
    context: WebviewViewResolveContext,
    token: CancellationToken
  ): void {    
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [Uri.joinPath(this.context.extensionUri, "dist")],
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
  };
}
