import {
  Disposable,
  Webview,
  WebviewPanel,
  window,
  Uri,
  ViewColumn,
  ExtensionContext,
  commands,
} from "vscode";

import { openExternalUrl } from "../utilities/vsc";
import { extensionContext } from "../utilities/extensionContext";
import { Logger } from "../Logger";
import { generateWebviewContent } from "./webviewContentGenerator";
import { DependencyChecker } from "../dependency/DependencyChecker";
import { DependencyInstaller } from "../dependency/DependencyInstaller";
import { DeviceManager } from "../devices/DeviceManager";
import { Project } from "../project/project";

const OPEN_PANEL_ON_ACTIVATION = "open_panel_on_activation";

export class PreviewsPanel {
  public static currentPanel: PreviewsPanel | undefined;
  private readonly _panel: WebviewPanel;
  private readonly dependencyChecker: DependencyChecker;
  private readonly dependencyInstaller: DependencyInstaller;
  private readonly deviceManager: DeviceManager;
  private readonly project: Project;
  private disposables: Disposable[] = [];

  private readonly callableObjects: Map<string, object>;

  private followEnabled = false;

  private constructor(panel: WebviewPanel) {
    this._panel = panel;

    // Set an event listener to listen for when the panel is disposed (i.e. when the user closes
    // the panel or when the panel is closed programmatically)
    this._panel.onDidDispose(() => this.dispose(), null, this.disposables);

    // Set the HTML content for the webview panel
    this._panel.webview.html = generateWebviewContent(
      extensionContext,
      this._panel.webview,
      extensionContext.extensionUri
    );

    // Set an event listener to listen for messages passed from the webview context
    this._setWebviewMessageListener(this._panel.webview);

    // Set the manager to listen and change the persisting storage for the extension.
    this.dependencyChecker = new DependencyChecker(this._panel.webview);
    this.dependencyChecker.setWebviewMessageListener();

    this.dependencyInstaller = new DependencyInstaller(this._panel.webview);
    this.dependencyInstaller.setWebviewMessageListener();

    this._setupEditorListeners();

    this.deviceManager = new DeviceManager();
    this.project = new Project(this.deviceManager);

    this.disposables.push(
      this.dependencyChecker,
      this.dependencyInstaller,
      this.deviceManager,
      this.project
    );

    this.callableObjects = new Map([
      ["DeviceManager", this.deviceManager as object],
      ["Project", this.project as object],
    ]);
  }

  public static extensionActivated(context: ExtensionContext) {
    if (context.workspaceState.get(OPEN_PANEL_ON_ACTIVATION)) {
      PreviewsPanel.render(context);
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
      PreviewsPanel.currentPanel.project.startPreview(`preview:/${fileName}:${lineNumber}`);
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

    // Dispose of all disposables (i.e. commands) for the current webview panel
    while (this.disposables.length) {
      const disposable = this.disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }

  private handleRemoteCall(message: any) {
    const { object, method, args, callId } = message;
    const callableObject = this.callableObjects.get(object);
    if (callableObject && method in callableObject) {
      const argsWithCallbacks = args.map((arg: any) => {
        if (typeof arg === "object" && "__callbackId" in arg) {
          const callbackId = arg.__callbackId;
          return (...args: any[]) => {
            this._panel.webview.postMessage({
              command: "callback",
              callbackId,
              args,
            });
          };
        } else {
          return arg;
        }
      });
      // @ts-ignore
      const result = callableObject[method](...argsWithCallbacks);
      if (result instanceof Promise) {
        result
          .then((result) => {
            this._panel.webview.postMessage({
              command: "callResult",
              callId,
              result,
            });
          })
          .catch((error) => {
            this._panel.webview.postMessage({
              command: "callResult",
              callId,
              error,
            });
          });
      } else {
        this._panel.webview.postMessage({
          command: "callResult",
          callId,
          result,
        });
      }
    }
  }

  private _setWebviewMessageListener(webview: Webview) {
    webview.onDidReceiveMessage(
      (message: any) => {
        const command = message.command;

        if (message.method !== "dispatchTouch") {
          Logger.log("Message from webview", message);
        }

        switch (command) {
          case "call":
            this.handleRemoteCall(message);
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

  private _setupEditorListeners() {
    extensionContext.subscriptions.push(
      window.onDidChangeActiveTextEditor((editor) => {
        if (editor) {
          this.project.onActiveFileChange(editor.document.fileName, this.followEnabled);
        }
      })
    );
  }
}
