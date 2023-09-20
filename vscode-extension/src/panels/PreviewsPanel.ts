import {
  Disposable,
  Webview,
  WebviewPanel,
  window,
  workspace,
  Uri,
  ViewColumn,
  ExtensionContext,
  Range,
} from "vscode";
import { getUri } from "../utilities/getUri";
import { getNonce } from "../utilities/getNonce";
import { runIOS } from "./runIOS";
import { Preview } from "./preview";
import { Devtools } from "./devtools";
import * as path from "path";

const crypto = require("crypto");

async function openFileAtPosition(filePath: string, line: number, column: number) {
  const existingDocument = workspace.textDocuments.find((document) => {
    console.log("Existing document list", document.uri.fsPath);
    return document.uri.fsPath === filePath;
  });

  if (existingDocument) {
    // If the file is already open, show (focus on) its editor
    await window.showTextDocument(existingDocument, {
      selection: new Range(line, column, line, column),
      viewColumn: ViewColumn.One,
    });
  } else {
    // If the file is not open, open it in a new editor
    const document = await workspace.openTextDocument(filePath);
    await window.showTextDocument(document, {
      selection: new Range(line, column, line, column),
      viewColumn: ViewColumn.One,
    });
  }
}

function isFileInWorkspace(workspaceDir: string, filePath: string): boolean {
  // Get the relative path from the workspace directory to the file
  const relative = path.relative(workspaceDir, filePath);

  // If the relative path starts with "..", the file is outside the workspace
  return (
    !relative.startsWith("..") && !path.isAbsolute(relative) && !relative.startsWith("node_modules")
  );
}

function portHash(name: string) {
  const hash = crypto.createHash("sha256");
  hash.update(name);
  const hashBytes = hash.digest();

  // Convert hash bytes to BigInt
  const hashNumber = BigInt(`0x${hashBytes.toString("hex")}`);
  return 45000 + Number(hashNumber % BigInt(4000));
}

export class PreviewsPanel {
  public static currentPanel: PreviewsPanel | undefined;
  private readonly _panel: WebviewPanel;
  private readonly _context: ExtensionContext;
  private _disposables: Disposable[] = [];
  private _preview: Preview | undefined;
  private _devtools: Devtools | undefined;
  private _previewEnabled = false;
  private _lastEditorFilename: string | undefined;

  private constructor(panel: WebviewPanel, context: ExtensionContext) {
    this._panel = panel;
    this._context = context;
    this._lastEditorFilename = window.activeTextEditor?.document.fileName;

    // Set an event listener to listen for when the panel is disposed (i.e. when the user closes
    // the panel or when the panel is closed programmatically)
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Set the HTML content for the webview panel
    this._panel.webview.html = this._getWebviewContent(this._panel.webview, context.extensionUri);

    // Set an event listener to listen for messages passed from the webview context
    this._setWebviewMessageListener(this._panel.webview);

    this._setupEditorListeners(context);
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
            Uri.parse("http://localhost:8060"),
          ],
        }
      );

      PreviewsPanel.currentPanel = new PreviewsPanel(panel, context);
    }

    if (fileName !== undefined && lineNumber !== undefined) {
      PreviewsPanel.currentPanel.selectPreview(`preview:/${fileName}:${lineNumber}`);
    }
  }

  public dispose() {
    PreviewsPanel.currentPanel = undefined;

    // Dispose of the current webview panel
    this._panel.dispose();

    // Dispose of all disposables (i.e. commands) for the current webview panel
    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }

  private _getWebviewContent(webview: Webview, extensionUri: Uri) {
    // The CSS file from the React build output
    const stylesUri = getUri(webview, extensionUri, ["webview-ui", "build", "assets", "index.css"]);
    // The JS file from the React build output
    const scriptUri = getUri(webview, extensionUri, ["webview-ui", "build", "assets", "index.js"]);
    const baseUri = getUri(webview, extensionUri, ["webview-ui", "build"]);
    const codiconsUri = webview.asWebviewUri(
      Uri.joinPath(extensionUri, "node_modules", "@vscode/codicons", "dist", "codicon.css")
    );

    const nonce = getNonce();

    // Tip: Install the es6-string-html VS Code extension to enable code highlighting below
    return /*html*/ `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src vscode-resource: http: https: data:; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
          <link rel="stylesheet" type="text/css" href="${stylesUri}">
          <link rel="stylesheet" href="${codiconsUri}" >
          <base href="${baseUri}">
        </head>
        <body>
          <div id="root"></div>
          <script>
            window.baseUri = "${baseUri}";
          </script>
          <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
        </body>
      </html>
    `;
  }

  private async launchProject() {
    let workspaceDir = workspace.workspaceFolders?.[0]?.uri?.fsPath;
    if (!workspaceDir) {
      console.warn("No workspace directory found");
      return;
    }

    const metroPort = 8081; //portHash(`metro://workspaceDir`);
    const devtoolsPort = 8097; //portHash(`devtools://workspaceDir`);
    console.log("Ports metro:", metroPort, "devtools:", devtoolsPort);
    // this._metro = new Metro(workspaceDir, metroPort);

    this._devtools = new Devtools({ port: devtoolsPort });

    // await runIOS(workspaceDir);

    const preview = new Preview((previewURL: string) => {
      console.log("preview ready", previewURL);
      this._panel.webview.postMessage({
        command: "previewReady",
        previewURL,
      });
      window.showInformationMessage("Preview ready 🚀");
      this._preview?.shutdown();
      this._preview = preview;
    });
  }

  private inspectElement(xRatio: number, yRatio: number) {
    this._devtools?.send("startInspectingNative");
    this._devtools?.addListener((event: string, payload: any) => {
      if (event === "selectFiber") {
        const id: number = payload;
        console.log("Inspect eleemnt", id);
        this._devtools?.send("inspectElement", {
          id,
          rendererID: 1,
          forceFullData: true,
          requesID: 77,
          path: null,
        });
      } else if (event === "inspectedElement") {
        try {
          console.log("PL", payload);
          const { fileName, lineNumber, columnNumber } = payload.value.source;
          if (isFileInWorkspace(workspace.workspaceFolders?.[0]?.uri?.fsPath || "", fileName)) {
            openFileAtPosition(fileName, lineNumber - 1, columnNumber - 1);
            return;
          }
        } catch (e) {
          console.log("Err", e);
        }
        if (payload.value.owners.length > 0) {
          console.log("Inspect", payload.value.owners[0].id);
          this._devtools?.send("inspectElement", {
            id: payload.value.owners[0].id,
            rendererID: 1,
            forceFullData: true,
            requesID: 77,
            path: null,
          });
        }
      }
    });
    setTimeout(() => {
      this._preview?.sendTouch(xRatio, yRatio, "Down");
      this._preview?.sendTouch(xRatio, yRatio, "Up");
    }, 200);
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
          case "runCommand":
            this.launchProject();
            return;
          case "touch":
            this._preview?.sendTouch(message.xRatio, message.yRatio, message.type);
            return;
          case "inspect":
            this.inspectElement(message.xRatio, message.yRatio);
            return;
          case "stopInspecting":
            this._devtools?.send("stopInspectingNative");
            return;
          case "stopPreview":
            this.stopPreview();
            return;
          case "startPreview":
            this.startPreview();
            return;
          case "selectPreview":
            this.selectPreview(message.appKey);
            return;
        }
      },
      undefined,
      this._disposables
    );
  }

  private selectPreview(appKey: string) {
    this._previewEnabled = true;
    this._devtools?.rpc("rnp_listPreviews", { appKey: "main" }, "rnp_previewsList", (payload) => {
      const { previews } = payload;
      if (previews.find((preview) => preview.appKey === appKey)) {
        this._devtools?.send("rnp_runApplication", { appKey });
      } else {
        console.log("nono", appKey, previews);
      }
    });
  }

  private startPreview() {
    console.log("start prevbiew");
    this._previewEnabled = true;
    this._devtools?.rpc("rnp_listPreviews", { appKey: "main" }, "rnp_previewsList", (payload) => {
      const { previews } = payload;
      if (this._lastEditorFilename) {
        // find preview name that matches the current filename
        const filteredPreviews = previews.filter((preview) => {
          return preview.fileName === this._lastEditorFilename;
        });
        filteredPreviews.sort((a, b) => a.lineNumber - b.lineNumber);
        if (filteredPreviews.length > 0) {
          this.selectPreview(filteredPreviews[0].appKey);
          this._panel.webview.postMessage({
            command: "previewsList",
            previews: filteredPreviews,
          });
        } else {
          let href = path.relative(
            workspace.workspaceFolders?.[0]?.uri?.fsPath || "",
            this._lastEditorFilename
          );
          href = removeExtension(href);
          if (href.endsWith("index")) {
            href = href.slice(0, -5);
          }
          if (href.startsWith("app")) {
            href = href.substring(3);
          }
          console.log("Href", href);
          this._devtools?.send("rnp_openRouterLink", { href });
        }
      }
    });
  }

  private stopPreview() {
    this._previewEnabled = false;
    this._devtools?.send("rnp_runApplication", { appKey: "main" });
  }

  private onActiveFileChange(filename) {
    console.log("LastEditor", filename);
    this._lastEditorFilename = filename;
    if (this._previewEnabled) {
      this.startPreview();
    }
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

function removeExtension(filename) {
  return filename.replace(/\.[^\.]+$/, "");
}
