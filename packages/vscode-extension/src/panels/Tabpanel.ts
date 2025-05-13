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
  WebviewPanelSerializer,
} from "vscode";

import { extensionContext } from "../utilities/extensionContext";
import { generateWebviewContent } from "./webviewContentGenerator";
import { WebviewController } from "./WebviewController";
import { disposeAll } from "../utilities/disposables";
import { PREVIEW_WEBVIEW_NAME, PREVIEW_WEBVIEW_PATH } from "../webview/utilities/constants";

export class TabPanel implements Disposable {
  public static readonly viewType = "RadonIDETabPanel";
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
      PREVIEW_WEBVIEW_NAME,
      PREVIEW_WEBVIEW_PATH
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

  public static restore(panel: WebviewPanel) {
    TabPanel.currentPanel?.dispose();
    TabPanel.currentPanel = new TabPanel(panel, extensionContext);
  }

  private static showInternal(viewColumn: ViewColumn, preserveFocus: boolean) {
    const panel = TabPanel.currentPanel;
    if (panel) {
      panel._panel.reveal(viewColumn, preserveFocus);
    } else {
      const webviewPanel = window.createWebviewPanel(
        TabPanel.viewType,
        "Radon IDE",
        { viewColumn, preserveFocus },
        {
          enableScripts: true,
          localResourceRoots: [
            Uri.joinPath(extensionContext.extensionUri, "dist"),
            Uri.joinPath(extensionContext.extensionUri, "node_modules"),
          ],
          retainContextWhenHidden: true,
        }
      );
      TabPanel.restore(webviewPanel);
    }
  }

  public static async show(
    newLocation: "editor-tab" | "new-window" | undefined,
    preserveFocus = false
  ) {
    if (newLocation === "new-window") {
      await commands.executeCommand("workbench.action.newEmptyEditorWindow");
      // we ignore errors for the enabelCompactAuxiliaryWindow command as it only's been added
      // in VSCode 1.100 and won't be available in older versions or VSCode forks
      await commands
        .executeCommand("workbench.action.enableCompactAuxiliaryWindow")
        .then(null, () => {});
      // we find the last empty editor group and assume it belongs to the newly opened window
      const emptyEditorGroups = window.tabGroups.all.filter((group) => group.tabs.length === 0);
      if (emptyEditorGroups.length > 0) {
        const lastEmptyGroup = emptyEditorGroups[emptyEditorGroups.length - 1];
        this.showInternal(lastEmptyGroup.viewColumn, preserveFocus);
      }
    } else {
      // We can't tell whether the panel is in new window or in some horizonal/vertical group
      // we use the following logic to handle different cases:
      // 1. If the current panel viewColumn is > 1, this means it could be in a new window,
      // in this case we move it to the first group
      // 2. Alternatively, if panel doesn't exist, or it is in the first group, we
      // use "Beside" mode to open it beside the current editor.
      const currentViewColumn = TabPanel.currentPanel?._panel.viewColumn || 0;
      this.showInternal(currentViewColumn > 1 ? ViewColumn.One : ViewColumn.Beside, preserveFocus);
    }
  }

  public dispose() {
    commands.executeCommand("setContext", "RNIDE.panelIsOpen", false);
    commands.executeCommand("setContext", "RNIDE.isTabPanelFocused", false);

    TabPanel.currentPanel = undefined;

    disposeAll(this.disposables);
  }
}

export class TabPanelSerializer implements WebviewPanelSerializer {
  public async deserializeWebviewPanel(webviewPanel: WebviewPanel, state: any): Promise<void> {
    TabPanel.restore(webviewPanel);
  }
}
