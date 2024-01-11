import {
  Disposable,
  Webview,
  WebviewPanel,
  window,
  Uri,
  ViewColumn,
  ExtensionContext,
  debug,
  commands,
} from "vscode";

import { openExternalUrl } from "../utilities/vsc";
import { WorkspaceStateManager } from "./WorkspaceStateManager";
import { Logger } from "../Logger";
import { generateWebviewContent } from "./webviewContentGenerator";
import { DependencyChecker } from "../dependency/DependencyChecker";
import { DependencyInstaller } from "../dependency/DependencyInstaller";
import { DeviceManager } from "../devices/DeviceManager";
import { ProjectManager } from "../project/ProjectManager";

const PREVIEW_PANEL_COMMANDS = [
  "log",
  "debugResume",
  "openLogs",
  "openExternalUrl",
  "stopFollowing",
  "startFollowing",
];

export class PreviewsPanel {
  public static currentPanel: PreviewsPanel | undefined;
  private readonly _panel: WebviewPanel;
  private readonly workspaceStateManager: WorkspaceStateManager;
  private readonly dependencyChecker: DependencyChecker;
  private readonly dependencyInstaller: DependencyInstaller;
  private readonly context: ExtensionContext;
  private readonly deviceManager: DeviceManager;
  private readonly projectManager: ProjectManager;
  private disposables: Disposable[] = [];
  private projectStarted = false;

  private followEnabled = false;

  private constructor(panel: WebviewPanel, context: ExtensionContext) {
    this._panel = panel;
    this.context = context;

    // Set an event listener to listen for when the panel is disposed (i.e. when the user closes
    // the panel or when the panel is closed programmatically)
    this._panel.onDidDispose(() => this.dispose(), null, this.disposables);

    // Set the HTML content for the webview panel
    this._panel.webview.html = generateWebviewContent(
      context,
      this._panel.webview,
      context.extensionUri
    );

    // Set an event listener to listen for messages passed from the webview context
    this._setWebviewMessageListener(this._panel.webview);

    // Set the manager to listen and change the persisting storage for the extension.
    this.workspaceStateManager = new WorkspaceStateManager(context, this._panel.webview);
    this.workspaceStateManager.startListening();

    this.dependencyChecker = new DependencyChecker(this._panel.webview);
    this.dependencyChecker.setWebviewMessageListener();

    this.dependencyInstaller = new DependencyInstaller(this._panel.webview);
    this.dependencyInstaller.setWebviewMessageListener();

    this._setupEditorListeners(context);

    this.deviceManager = new DeviceManager(this._panel.webview);
    this.deviceManager.startListening();

    this.projectManager = new ProjectManager(this._panel.webview, this.workspaceStateManager, context);
    this.projectManager.startListening();
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
            Uri.joinPath(context.extensionUri, "dist"),
            Uri.joinPath(context.extensionUri, "node_modules"),
          ],
          retainContextWhenHidden: true,
        }
      );
      PreviewsPanel.currentPanel = new PreviewsPanel(panel, context);
      commands.executeCommand("workbench.action.lockEditorGroup");
    }

    if (fileName !== undefined && lineNumber !== undefined) {
      PreviewsPanel.currentPanel.projectManager.startPreview(`preview:/${fileName}:${lineNumber}`);
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

  public notifyAppReady(deviceId: string, previewURL: string) {
    this._panel.webview.postMessage({
      command: "appReady",
      deviceId: deviceId,
      previewURL: previewURL,
    });
  }

  public notifyNavigationChanged({ displayName, id }: { displayName: string; id: string }) {
    this._panel.webview.postMessage({
      command: "navigationChanged",
      displayName,
      id,
    });
  }

  private _setWebviewMessageListener(webview: Webview) {
    webview.onDidReceiveMessage(
      (message: any) => {
        const command = message.command;

        if (!PREVIEW_PANEL_COMMANDS.includes(command)) {
          return;
        }

        Logger.log(`Extension received a message with command ${command}.`);

        switch (command) {
          case "log":
            return;
          case "debugResume":
            debug.activeDebugSession?.customRequest("continue");
            return;
          case "openLogs":
            commands.executeCommand("workbench.panel.repl.view.focus");
            return;
          case "openExternalUrl":
            openExternalUrl(message.url);
            return;
          case "stopFollowing":
            this.followEnabled = false;
            return;
          case "startFollowing":
            this.followEnabled = true;
            return;
        }
      },
      undefined,
      this.disposables
    );
  }

  private _onActiveFileChange(filename: string) {
    Logger.debug(`LastEditor ${filename}`);
    this.projectManager.onActiveFileChange(filename, this.followEnabled);
  }

  private _setupEditorListeners(context: ExtensionContext) {
    context.subscriptions.push(
      window.onDidChangeActiveTextEditor((editor) => {
        if (editor) {
          this._onActiveFileChange(editor.document.fileName);
        }
      })
    );
  }
}
