import {
  Disposable,
  Webview,
  WebviewPanel,
  window,
  workspace,
  Uri,
  ViewColumn,
  ExtensionContext,
  debug,
  commands,
} from "vscode";
import { getUri } from "../utilities/getUri";
import { getNonce } from "../utilities/getNonce";
import { isFileInWorkspace } from "../utilities/isFileInWorkspace";
import { openFileAtPosition } from "../utilities/openFileAtPosition";

import { Project } from "../project/project";
import { getDevServerScriptUrl, isDev } from "../utilities/common";

export class PreviewsPanel {
  public static currentPanel: PreviewsPanel | undefined;
  private readonly _panel: WebviewPanel;
  private readonly project: Project;
  private disposables: Disposable[] = [];

  private followEnabled = false;

  private constructor(panel: WebviewPanel, context: ExtensionContext) {
    this._panel = panel;

    // Set an event listener to listen for when the panel is disposed (i.e. when the user closes
    // the panel or when the panel is closed programmatically)
    this._panel.onDidDispose(() => this.dispose(), null, this.disposables);

    // Set the HTML content for the webview panel
    this._panel.webview.html = this._getWebviewContent(this._panel.webview, context.extensionUri);

    // Set an event listener to listen for messages passed from the webview context
    this._setWebviewMessageListener(this._panel.webview);

    this._setupEditorListeners(context);

    this.project = new Project(context);
    this.project.start();
    this.project.addEventMonitor({
      onLogReceived: (message) => {
        this._panel.webview.postMessage({
          command: "logEvent",
          type: message.type,
        });
      },
      onDebuggerPaused: () => {
        this._panel.webview.postMessage({
          command: "debuggerPaused",
        });
      },
      onDebuggerContinued: () => {
        this._panel.webview.postMessage({
          command: "debuggerContinued",
        });
      },
      onUncaughtException: (isFatal) => {
        this._panel.webview.postMessage({
          command: "uncaughtException",
          isFatal: isFatal,
        });
      },
    });
    this.disposables.push(this.project);
  }

  public static render(context: ExtensionContext, fileName?: string, lineNumber?: number) {
    if (PreviewsPanel.currentPanel) {
      // If the webview panel already exists reveal it
      PreviewsPanel.currentPanel._panel.reveal(ViewColumn.Beside);
    } else {
      // If a webview panel does not already exist create and show a new one
      const panel = window.createWebviewPanel(
        "RNPreview",
        "React Native Preview",
        ViewColumn.Beside,
        {
          enableScripts: true,
          localResourceRoots: [
            Uri.joinPath(context.extensionUri, "out"),
            Uri.joinPath(context.extensionUri, "webview-ui/build"),
            Uri.joinPath(context.extensionUri, "webview-ui/node_modules"),
            Uri.parse("http://localhost:8060"),
          ],
          retainContextWhenHidden: true,
        }
      );

      PreviewsPanel.currentPanel = new PreviewsPanel(panel, context);
      commands.executeCommand("workbench.action.lockEditorGroup");
    }

    if (fileName !== undefined && lineNumber !== undefined) {
      PreviewsPanel.currentPanel.project.startPreview(`preview:/${fileName}:${lineNumber}`);
    }
  }

  public dispose() {
    PreviewsPanel.currentPanel = undefined;

    // Dispose of the current webview panel
    this._panel.dispose();

    // Dispose of all disposables (i.e. commands) for the current webview panel
    while (this.disposables.length) {
      const disposable = this.disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }

  private _getWebviewContent(webview: Webview, extensionUri: Uri) {
    // The CSS file from the React build output
    const stylesUri = getUri(webview, extensionUri, ["webview-ui", "build", "main.css"]);
    // The JS file from the React build output
    const scriptUri = isDev() ? getDevServerScriptUrl() : getUri(webview, extensionUri, ["webview-ui", "build", "bundle.js"]);
    console.log("SCRIPT URI", scriptUri);
    const baseUri = getUri(webview, extensionUri, ["webview-ui", "build"]);

    const codiconsUri = getUri(webview, extensionUri, [
      "webview-ui",
      "node_modules",
      "@vscode/codicons",
      "dist",
      "codicon.css",
    ]);

    const nonce = getNonce();

    // Tip: Install the es6-string-html VS Code extension to enable code highlighting below
    return /*html*/ `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          ${isDev() ? '' : `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src vscode-resource: http: https: data:; style-src ${webview.cspSource}; script-src 'nonce-${nonce}'; font-src vscode-resource: https:;">`}
          ${isDev() ? '' : `<link rel="stylesheet" type="text/css" href="${stylesUri}">`}
          <link rel="stylesheet" href="${codiconsUri}" >
          <base href="${baseUri}">
        </head>
        <body>
          <div id="root"></div>
          <script nonce="${nonce}">
            window.baseUri = "${baseUri}";
          </script>
          <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
        </body>
      </html>
    `;
  }

  public notifyAppReady(deviceId: string, previewURL: string) {
    this._panel.webview.postMessage({
      command: "appReady",
      deviceId: deviceId,
      previewURL: previewURL,
    });
  }

  public notifyAppUrlChanged(appKey: string) {
    this._panel.webview.postMessage({
      command: "appUrlChanged",
      url: appKey,
    });
  }

  private _setWebviewMessageListener(webview: Webview) {
    webview.onDidReceiveMessage(
      (message: any) => {
        const command = message.command;
        const text = message.text;

        switch (command) {
          case "log":
            console.log(`Webview: ${text}`);
            return;
          case "debugResume":
            debug.activeDebugSession?.customRequest("continue");
            return;
          case "changeDevice":
            this.project.selectDevice(message.deviceId, message.settings);
            return;
          case "changeDeviceSettings":
            this.project.changeDeviceSettings(message.deviceId, message.settings);
            return;
          case "touch":
            this.project.sendTouch(message.deviceId, message.xRatio, message.yRatio, message.type);
            return;
          case "inspect":
            this.project.inspectElementAt(message.xRatio, message.yRatio, (inspectData) => {
              this._panel.webview.postMessage({
                command: "inspectData",
                data: inspectData,
              });
              if (message.type === "Down") {
                // find last element in inspectData.hierarchy with source that belongs to the workspace
                for (let i = inspectData.hierarchy.length - 1; i >= 0; i--) {
                  const element = inspectData.hierarchy[i];
                  if (isFileInWorkspace(element.source.fileName)) {
                    openFileAtPosition(
                      element.source.fileName,
                      element.source.lineNumber - 1,
                      element.source.columnNumber - 1
                    );
                    break;
                  }
                }
              }
            });
            return;
          case "openUrl":
            this.project.openUrl(message.url);
            return;
          case "stopFollowing":
            this.followEnabled = false;
            return;
          case "startFollowing":
            this.followEnabled = true;
            return;
          case "openLogs":
            commands.executeCommand("workbench.panel.repl.view.focus");
            return;
        }
      },
      undefined,
      this.disposables
    );
  }

  private onActiveFileChange(filename: string) {
    console.log("LastEditor", filename);
    this.project.onActiveFileChange(filename, this.followEnabled);
  }

  private _setupEditorListeners(context: ExtensionContext) {
    context.subscriptions.push(
      window.onDidChangeActiveTextEditor((editor) => {
        if (editor) {
          this.onActiveFileChange(editor.document.fileName);
        }
      })
    );
  }
}
