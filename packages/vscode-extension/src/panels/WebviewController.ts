import { Webview, Disposable, window, commands } from "vscode";
import { DependencyChecker } from "../dependency/DependencyChecker";
import { DependencyInstaller } from "../dependency/DependencyInstaller";
import { DeviceManager } from "../devices/DeviceManager";
import { Project } from "../project/project";
import { openExternalUrl } from "../utilities/vsc";
import { Logger } from "../Logger";
import { extensionContext } from "../utilities/extensionContext";
import { WorkspaceConfigController } from "./WorkspaceConfigController";

export class WebviewController implements Disposable {
  private readonly dependencyChecker: DependencyChecker;
  private readonly dependencyInstaller: DependencyInstaller;
  private readonly deviceManager: DeviceManager;
  public readonly project: Project;
  public readonly workspaceConfig: WorkspaceConfigController;
  private disposables: Disposable[] = [];

  private followEnabled = false;

  private readonly callableObjects: Map<string, object>;

  constructor(private webview: Webview) {
    // Set an event listener to listen for messages passed from the webview context
    this.setWebviewMessageListener(webview);

    // Set the manager to listen and change the persisting storage for the extension.
    this.dependencyChecker = new DependencyChecker(webview);
    this.dependencyChecker.setWebviewMessageListener();

    this.dependencyInstaller = new DependencyInstaller(webview);
    this.dependencyInstaller.setWebviewMessageListener();

    this.setupEditorListeners();

    this.deviceManager = new DeviceManager();
    this.project = new Project(this.deviceManager);

    this.workspaceConfig = new WorkspaceConfigController();

    this.disposables.push(
      this.dependencyChecker,
      this.dependencyInstaller,
      this.deviceManager,
      this.project,
      this.workspaceConfig
    );

    this.callableObjects = new Map([
      ["DeviceManager", this.deviceManager as object],
      ["Project", this.project as object],
      ["WorkspaceConfig", this.workspaceConfig as object],
    ]);

    commands.executeCommand("setContext", "RNIDE.panelIsOpen", true);
  }

  public dispose() {
    commands.executeCommand("setContext", "RNIDE.panelIsOpen", false);

    // Dispose of all disposables (i.e. commands) for the current webview
    while (this.disposables.length) {
      const disposable = this.disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }

  private setWebviewMessageListener(webview: Webview) {
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

  private handleRemoteCall(message: any) {
    const { object, method, args, callId } = message;
    const callableObject = this.callableObjects.get(object);
    if (callableObject && method in callableObject) {
      const argsWithCallbacks = args.map((arg: any) => {
        if (typeof arg === "object" && "__callbackId" in arg) {
          const callbackId = arg.__callbackId;
          return (...options: any[]) => {
            this.webview.postMessage({
              command: "callback",
              callbackId,
              options,
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
          .then((res) => {
            this.webview.postMessage({
              command: "callResult",
              callId,
              res,
            });
          })
          .catch((error) => {
            this.webview.postMessage({
              command: "callResult",
              callId,
              error,
            });
          });
      } else {
        this.webview.postMessage({
          command: "callResult",
          callId,
          result,
        });
      }
    }
  }

  private setupEditorListeners() {
    extensionContext.subscriptions.push(
      window.onDidChangeActiveTextEditor((editor) => {
        if (editor) {
          this.project.onActiveFileChange(editor.document.fileName, this.followEnabled);
        }
      })
    );
  }
}
