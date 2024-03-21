import { ExtensionContext, Uri, WebviewView, WebviewViewProvider, commands } from "vscode";
import { generateWebviewContent } from "./webviewContentGenerator";
import { extensionContext } from "../utilities/extensionContext";
import { PreviewWebviewController } from "./PreviewWebviewController";

export class PreviewsViewProvider implements WebviewViewProvider {
  public static readonly viewType = "IDE-view";
  private _view: any = null;
  private previewWebviewController: any = null;

  constructor(private readonly context: ExtensionContext) {}

  refresh(): void {
    this._view.webview.html = generateWebviewContent(
      this.context,
      this._view.webview,
      this.context.extensionUri
    );
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
    this.previewWebviewController = new PreviewWebviewController(this._view.webview);
    // Set an event listener to listen for when the webview is disposed (i.e. when the user changes
    // settings or hiddes conteiner view by hand, https://code.visualstudio.com/api/references/vscode-api#WebviewView)
    webviewView.onDidDispose(() => {
      this.previewWebviewController?.dispose();
    });
    commands.executeCommand("setContext", "RNIDE.previewsViewIsOpen", true);
  }
}
