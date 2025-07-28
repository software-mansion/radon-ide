import { Webview, Disposable, commands, Uri, workspace } from "vscode";
import { Logger } from "../Logger";
import { getTelemetryReporter } from "../utilities/telemetry";
import { IDE } from "../project/ide";
import { disposeAll } from "../utilities/disposables";
import { RENDER_OUTLINES_PLUGIN_ID } from "../common/RenderOutlines";
import { PanelLocation, RecursivePartial, State } from "../common/State";

type EventBase = Record<string, unknown>;

interface CallCommand extends EventBase {
  command: "call";
}
interface GetStateCommand extends EventBase {
  command: "RNIDE_get_state";
}
interface SetStateCommand extends EventBase {
  command: "RNIDE_set_state";
}
interface FocusPreviewCommand extends EventBase {
  command: "focusPreview";
}
interface BlurPreviewCommand extends EventBase {
  command: "blurPreview";
}

interface CallArgs {
  callId: string;
  object: string;
  method: string;
  args: unknown[];
}
interface GetStateArgs {
  callId: string;
}
interface SetStateArgs {
  callId: string;
  state: Partial<State>;
}

type CallEvent = CallCommand & CallArgs;
type GetStateEvent = GetStateCommand & GetStateArgs;
type SetStateEvent = SetStateCommand & SetStateArgs;
type FocusPreviewEvent = FocusPreviewCommand;
type BlurPreviewEvent = BlurPreviewCommand;

export type WebviewEvent =
  | CallEvent
  | GetStateEvent
  | SetStateEvent
  | FocusPreviewEvent
  | BlurPreviewEvent;

export class WebviewController implements Disposable {
  private disposables: Disposable[] = [];
  private idToCallback: Map<string, WeakRef<any>> = new Map();
  private idToCallbackFinalizationRegistry = new FinalizationRegistry((callbackId: string) => {
    this.idToCallback.delete(callbackId);
    this.webview.postMessage({
      command: "cleanupCallback",
      callbackId,
    });
  });

  private readonly callableObjectGetters: Map<string, () => object>;
  private readonly ide;

  constructor(private webview: Webview) {
    this.ide = IDE.attach();
    this.disposables.push(this.ide.onStateChanged(this.onStateUpdated));

    // Set an event listener to listen for messages passed from the webview context
    this.setWebviewMessageListener(webview);

    this.callableObjectGetters = new Map([
      ["DeviceManager", () => this.ide.deviceManager as object],
      ["Project", () => this.ide.project as object],
      ["DeviceSessionsManager", () => this.ide.project.deviceSessionsManager as object],
      ["WorkspaceConfig", () => this.ide.workspaceConfigController as object],
      ["AppRootConfig", () => this.ide.project.appRootConfigController as object],
      ["Utils", () => this.ide.utils as object],
      [
        "RenderOutlines",
        () => this.ide.project.deviceSession!.getPlugin(RENDER_OUTLINES_PLUGIN_ID) as object,
      ],
    ]);

    commands.executeCommand("setContext", "RNIDE.panelIsOpen", true);

    const panelLocation = workspace
      .getConfiguration("RadonIDE")
      .get<PanelLocation>("panelLocation");

    getTelemetryReporter().sendTelemetryEvent("panelOpened", {
      panelLocation,
    });
  }

  public onStateUpdated = (partialState: RecursivePartial<State>) => {
    this.webview.postMessage({
      command: "RNIDE_state_updated",
      state: partialState,
    });
  };

  public asWebviewUri(uri: Uri) {
    return this.webview.asWebviewUri(uri);
  }

  public dispose() {
    commands.executeCommand("setContext", "RNIDE.panelIsOpen", false);
    disposeAll(this.disposables);
    this.ide.detach();
  }

  private setWebviewMessageListener(webview: Webview) {
    webview.onDidReceiveMessage(
      (message: WebviewEvent) => {
        // ignore dispatchTouches and log calls from being logged as "Message from webview"
        if (!message.method || (message.method !== "dispatchTouches" && message.method !== "log")) {
          Logger.log("Message from webview", message);
        }
        if (message.command === "call") {
          this.handleRemoteCall(message);
        } else if (message.command === "RNIDE_get_state") {
          this.handleGetState(message);
        } else if (message.command === "RNIDE_set_state") {
          this.handleSetState(message);
        } else if (message.command === "focusPreview") {
          commands.executeCommand("setContext", "RNIDE.isPreviewFocused", true);
        } else if (message.command === "blurPreview") {
          commands.executeCommand("setContext", "RNIDE.isPreviewFocused", false);
        }
      },
      undefined,
      this.disposables
    );
  }

  private handleRemoteCall(message: CallArgs) {
    const { object, method, args, callId } = message;
    const callableObjectGetter = this.callableObjectGetters.get(object);
    const callableObject = callableObjectGetter?.();
    if (callableObject && method in callableObject) {
      const argsWithCallbacks = args.map((arg: any) => {
        if (typeof arg === "object" && arg !== null) {
          if ("__callbackId" in arg) {
            const callbackId = arg.__callbackId;
            let callback = this.idToCallback.get(callbackId)?.deref();
            if (!callback) {
              callback = (...options: any[]) => {
                this.webview.postMessage({
                  command: "callback",
                  callbackId,
                  args: options,
                });
              };
              this.idToCallback.set(callbackId, new WeakRef(callback));
              if (this.idToCallback.size > 200) {
                Logger.warn("Too many callbacks in memory! Something is wrong!");
              }
              this.idToCallbackFinalizationRegistry.register(callback, callbackId);
            }
            return callback;
          } else if ("__error" in arg) {
            const error = new Error(arg.__error.message);
            Object.assign(error, arg.__error);
            return error;
          }
        }
        return arg;
      });
      // @ts-ignore
      const result = callableObject[method](...argsWithCallbacks);
      if (result instanceof Promise) {
        result
          .then((res) => {
            this.webview.postMessage({
              command: "callResult",
              callId,
              result: res,
            });
          })
          .catch((error) => {
            this.webview.postMessage({
              command: "callResult",
              callId,
              error: { name: error.name, message: error.message },
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

  private async handleGetState(message: GetStateArgs) {
    const state = await this.ide.getState();
    this.webview.postMessage({
      command: "RNIDE_get_state_result",
      callId: message.callId,
      result: state,
    });
  }

  private async handleSetState(message: SetStateArgs) {
    await this.ide.setState(message.state);
  }
}
