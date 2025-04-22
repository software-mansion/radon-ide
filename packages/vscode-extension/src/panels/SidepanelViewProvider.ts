import {
  Disposable,
  ExtensionContext,
  Uri,
  WebviewView,
  WebviewViewProvider,
  commands,
  workspace,
} from "vscode";
import { generateWebviewContent } from "./webviewContentGenerator";
import { WebviewController } from "./WebviewController";
import { Logger } from "../Logger";
import { PREVIEW_WEBVIEW_NAME, PREVIEW_WEBVIEW_PATH } from "../webview/utilities/constants";

export class SidePanelViewProvider implements WebviewViewProvider, Disposable {
  public static readonly viewType = "RadonIDE.view";
  public static currentProvider: SidePanelViewProvider | undefined;
  private _view: any = null;
  public get view(): any {
    return this._view;
  }
  private webviewController: any = null;

  constructor(private readonly context: ExtensionContext) {
    SidePanelViewProvider.currentProvider = this;
  }

  public dispose() {
    this.webviewController?.dispose();
  }

  refresh(): void {
    this._view.webview.html = generateWebviewContent(
      this.context,
      this._view.webview,
      this.context.extensionUri,
      PREVIEW_WEBVIEW_NAME,
      PREVIEW_WEBVIEW_PATH
    );
  }

  public static showView() {
    if (SidePanelViewProvider.currentProvider) {
      commands.executeCommand(`${SidePanelViewProvider.viewType}.focus`);
      if (workspace.getConfiguration("RadonIDE").get("panelLocation") === "secondary-side-panel") {
        commands.executeCommand("workbench.action.focusAuxiliaryBar");
      }
    } else {
      Logger.error("SidepanelViewProvider does not exist.");
      return;
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
      this.context.extensionUri,
      PREVIEW_WEBVIEW_NAME,
      PREVIEW_WEBVIEW_PATH,
      ""
    );
    this._view = webviewView;
    this.webviewController = new WebviewController(this._view.webview);
    // Set an event listener to listen for when the webview is disposed (i.e. when the user changes
    // settings or hiddes container view by hand, https://code.visualstudio.com/api/references/vscode-api#WebviewView)
    webviewView.onDidDispose(() => {
      this.dispose();
    });
  }
}
