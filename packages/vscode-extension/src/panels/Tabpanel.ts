import {
  WebviewPanel,
  window,
  Uri,
  ViewColumn,
  ExtensionContext,
  commands,
  workspace,
  ConfigurationChangeEvent,
  Disposable,
} from "vscode";

import { extensionContext } from "../utilities/extensionContext";
import { generateWebviewContent } from "./webviewContentGenerator";
import { WebviewController } from "./WebviewController";
import { disposeAll } from "../utilities/disposables";

const OPEN_PANEL_ON_ACTIVATION = "open_panel_on_activation";

export class TabPanel implements Disposable {
  public static currentPanel: TabPanel | undefined;
  private readonly _panel: WebviewPanel;
  private disposables: Disposable[] = [];
  private webviewController: WebviewController;

  private constructor(panel: WebviewPanel, context: ExtensionContext) {
    this._panel = panel;
    this._panel.iconPath = Uri.joinPath(context.extensionUri, "assets", "logo.svg");
    // Set an event listener to listen for when the panel is disposed (i.e. when the user closes
    // the panel or when the panel is closed programmatically)

    commands.executeCommand("setContext", "RNIDE.isTabPanelFocused", this._panel.active);

    this._panel.onDidChangeViewState(
      (e) => {
        commands.executeCommand("setContext", "RNIDE.isTabPanelFocused", this._panel.active);
      },
      this,
      this.disposables
    );

    this._panel.onDidDispose(this.dispose, this, this.disposables);

    // Set the HTML content for the webview panel
    this._panel.webview.html = generateWebviewContent(
      extensionContext,
      this._panel.webview,
      extensionContext.extensionUri,
      "localhost:2137",
      "webview",
      "/src/webview"
    );

    this.webviewController = new WebviewController(this._panel.webview);
    this.disposables.push(this._panel, this.webviewController);

    workspace.onDidChangeConfiguration(
      (event: ConfigurationChangeEvent) => {
        if (!event.affectsConfiguration("RadonIDE")) {
          return;
        }
        if (workspace.getConfiguration("RadonIDE").get("panelLocation") !== "tab") {
          this.dispose();
        }
      },
      this,
      this.disposables
    );
  }

  public static render(context: ExtensionContext) {
    if (TabPanel.currentPanel) {
      // If the webview panel already exists reveal it
      TabPanel.currentPanel._panel.reveal();
    } else {
      // If a webview panel does not already exist create and show a new one

      // If there is an empty group in the editor, we will open the panel there:
      const emptyGroup = window.tabGroups.all.find((group) => group.tabs.length === 0);

      const panel = window.createWebviewPanel(
        "radon-ide-panel",
        "Radon IDE",
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
      TabPanel.currentPanel = new TabPanel(panel, context);
      context.workspaceState.update(OPEN_PANEL_ON_ACTIVATION, true);

      commands.executeCommand("workbench.action.lockEditorGroup");
    }
  }

  public dispose() {
    commands.executeCommand("setContext", "RNIDE.panelIsOpen", false);
    // this is triggered when the user closes the webview panel by hand, we want to reset open_panel_on_activation
    // key in this case to prevent extension from automatically opening the panel next time they open the editor
    extensionContext.workspaceState.update(OPEN_PANEL_ON_ACTIVATION, undefined);

    commands.executeCommand("setContext", "RNIDE.isTabPanelFocused", false);

    TabPanel.currentPanel = undefined;

    disposeAll(this.disposables);
  }
}
