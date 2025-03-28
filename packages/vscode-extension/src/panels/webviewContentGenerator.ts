import { ExtensionContext, Webview, Uri, workspace, ExtensionMode } from "vscode";
import { getUri } from "../utilities/getUri";
import { getNonce } from "../utilities/getNonce";
import { Platform } from "../utilities/platform";
import { EXTENSION_DEV_SERVER_HOST } from "../webview/utilities/constants";

export function generateWebviewContent(
  context: ExtensionContext,
  webview: Webview,
  extensionUri: Uri,
  webviewName: string,
  webviewDevPath: string,
  wsEndpoint?: string
) {
  const config = workspace.getConfiguration("RadonIDE");
  const useCodeTheme = config.get("themeType") === "vscode";
  const IS_DEV = context.extensionMode === ExtensionMode.Development;

  // The JS file from the React build output
  const scriptUri = IS_DEV
    ? webviewDevPath
      ? `${webviewDevPath}/index.jsx`
      : "/index.jsx"
    : `${webviewName}.js`;

  const baseUri = IS_DEV
    ? `http://${EXTENSION_DEV_SERVER_HOST}`
    : getUri(webview, extensionUri, ["dist/"]);

  const codiconsCssUri = IS_DEV
    ? getUri(webview, extensionUri, ["node_modules/@vscode/codicons/dist/codicon.css"])
    : "codicon.css";

  const nonce = getNonce();

  const VITE_DEV_PREABMLE = /*html*/ `
    <script type="module">
      import RefreshRuntime from "/@react-refresh";
      RefreshRuntime.injectIntoGlobalHook(window);
      window.$RefreshReg$ = () => {};
      window.$RefreshSig$ = () => (type) => type;
      window.__vite_plugin_react_preamble_installed__ = true;
    </script>
    <script type="module" src="/@vite/client"></script>
  `;

  const version = context.extension.packageJSON.version;

  return /*html*/ `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <base href="${baseUri}">
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta name="radon-ide-version" content="${version}" />
        ${wsEndpoint ? `<meta name='websocketEndpoint' content="${wsEndpoint}" />` : ""}
        <link rel="stylesheet" href="${codiconsCssUri}" />
        ${
          IS_DEV
            ? VITE_DEV_PREABMLE
            : `
        <meta http-equiv="Content-Security-Policy"
              content="default-src 'none';
                      img-src vscode-resource: http: https: data:;
                      media-src vscode-resource: http: https:;
                      style-src ${webview.cspSource} 'unsafe-inline';
                      script-src 'nonce-${nonce}';
                      ${wsEndpoint ? `connect-src ws://${wsEndpoint} ${webview.cspSource};` : ""}
                      font-src vscode-resource: https:;" />
        <link rel="stylesheet" type="text/css" href="${webviewName}.css" />
        <link rel="stylesheet" type="text/css" href="theme.css" />
        `
        }
      </head>
      <body data-use-code-theme="${useCodeTheme}">
        <div id="root"></div>
        <script nonce="${nonce}">window.RNIDE_hostOS = "${Platform.OS}";</script>
        <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
      </body>
    </html>
  `;
}
