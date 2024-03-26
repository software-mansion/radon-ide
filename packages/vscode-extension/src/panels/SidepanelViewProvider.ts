import { ExtensionContext, Uri, WebviewView, WebviewViewProvider, commands } from "vscode";
import { generateWebviewContent } from "./webviewContentGenerator";
import { extensionContext } from "../utilities/extensionContext";
import { WebviewController } from "./WebviewController";
import { Logger } from "../Logger";

export class SidepanelViewProvider implements WebviewViewProvider {
  public static readonly viewType = "ReactNativeIDE.view";
  public static currentProvider: SidepanelViewProvider | undefined;
  private _view: any = null;
  private webviewController: any = null;

  constructor(private readonly context: ExtensionContext) {
    SidepanelViewProvider.currentProvider = this;
  }

  refresh(): void {
    this._view.webview.html = generateWebviewContent(
      this.context,
      this._view.webview,
      this.context.extensionUri
    );
  }

  public static showView(context: ExtensionContext, fileName?: string, lineNumber?: number) {
    if (SidepanelViewProvider.currentProvider) {
      commands.executeCommand(`${SidepanelViewProvider.viewType}.focus`);
    } else {
      Logger.error("SidepanelViewProvider does not exist.");
      return;
    }

    if (fileName !== undefined && lineNumber !== undefined) {
      SidepanelViewProvider.currentProvider.webviewController.project.startPreview(
        `preview:/${fileName}:${lineNumber}`
      );
    }
  }

  //called when a view first becomes visible
  resolveWebviewView(webviewView: WebviewView): void | Thenable<void> {
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        Uri.joinPath(this.context.extensionUri, "dist"),
        Uri.joinPath(this.context.extensionUri, "node_modules"),
      ],
    };
    webviewView.webview.html = generateWebviewContent(
      this.context,
      webviewView.webview,
      this.context.extensionUri
    );
    this._view = webviewView;
    this.webviewController = new WebviewController(this._view.webview);
    // Set an event listener to listen for when the webview is disposed (i.e. when the user changes
    // settings or hiddes conteiner view by hand, https://code.visualstudio.com/api/references/vscode-api#WebviewView)
    webviewView.onDidDispose(() => {
      this.webviewController?.dispose();
    });
    commands.executeCommand("setContext", "RNIDE.previewsViewIsOpen", true);
  }
}
