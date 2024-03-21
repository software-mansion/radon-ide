import { WebviewPanel, window, Uri, ViewColumn, ExtensionContext, commands } from "vscode";

import { extensionContext } from "../utilities/extensionContext";
import { generateWebviewContent } from "./webviewContentGenerator";
import { PreviewWebviewController } from "./PreviewWebviewController";

const OPEN_PANEL_ON_ACTIVATION = "open_panel_on_activation";

export class PreviewsPanel {
  public static currentPanel: PreviewsPanel | undefined;
  private readonly _panel: WebviewPanel;
  private previewWebviewController: PreviewWebviewController;

  private constructor(panel: WebviewPanel) {
    this._panel = panel;

    // Set an event listener to listen for when the panel is disposed (i.e. when the user closes
    // the panel or when the panel is closed programmatically)
    this._panel.onDidDispose(() => this.dispose());

    // Set the HTML content for the webview panel
    this._panel.webview.html = generateWebviewContent(
      extensionContext,
      this._panel.webview,
      extensionContext.extensionUri
    );

    this.previewWebviewController = new PreviewWebviewController(this._panel.webview);
  }

  public static extensionActivated() {
    if (extensionContext.workspaceState.get(OPEN_PANEL_ON_ACTIVATION)) {
      PreviewsPanel.render(extensionContext);
    }
  }

  public static render(context: ExtensionContext, fileName?: string, lineNumber?: number) {
    if (PreviewsPanel.currentPanel) {
      // If the webview panel already exists reveal it
      PreviewsPanel.currentPanel._panel.reveal(ViewColumn.Beside);
    } else {
      // If a webview panel does not already exist create and show a new one

      // If there is an empty group in the editor, we will open the panel there:
      const emptyGroup = window.tabGroups.all.find((group) => group.tabs.length === 0);

      const panel = window.createWebviewPanel(
        "react-native-ide-panel",
        "React Native IDE",
        { viewColumn: emptyGroup?.viewColumn || ViewColumn.Beside },
        {
          enableScripts: true,
          localResourceRoots: [
            Uri.joinPath(context.extensionUri, "dist"),
            Uri.joinPath(context.extensionUri, "node_modules"),
          ],
          retainContextWhenHidden: true,
        }
      );
      PreviewsPanel.currentPanel = new PreviewsPanel(panel);
      context.workspaceState.update(OPEN_PANEL_ON_ACTIVATION, true);

      commands.executeCommand("workbench.action.lockEditorGroup");
      commands.executeCommand("setContext", "RNIDE.panelIsOpen", true);
    }

    if (fileName !== undefined && lineNumber !== undefined) {
      PreviewsPanel.currentPanel.previewWebviewController.project.startPreview(
        `preview:/${fileName}:${lineNumber}`
      );
    }
  }

  public dispose() {
    commands.executeCommand("setContext", "RNIDE.panelIsOpen", false);
    // this is triggered when the user closes the webview panel by hand, we want to reset open_panel_on_activation
    // key in this case to prevent extension from automatically opening the panel next time they open the editor
    extensionContext.workspaceState.update(OPEN_PANEL_ON_ACTIVATION, undefined);

    PreviewsPanel.currentPanel = undefined;

    // Dispose of the current webview panel
    this._panel.dispose();

    //dispose of current webwiew dependencies
    this.previewWebviewController.dispose();
  }
}
