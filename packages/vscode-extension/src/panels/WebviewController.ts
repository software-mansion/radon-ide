import { Webview, Disposable, commands, Uri, workspace } from "vscode";
import { Logger } from "../Logger";
import { getTelemetryReporter } from "../utilities/telemetry";
import { IDE } from "../project/ide";
import { disposeAll } from "../utilities/disposables";
import { RENDER_OUTLINES_PLUGIN_ID } from "../common/RenderOutlines";
import { PanelLocation, RecursivePartial, State, StateSerializer } from "../common/State";
import { undefined } from "zod";

type EventBase = Record<string, unknown>;

interface CallCommand extends EventBase {
  command: "call";
}
interface GetStateCommand extends EventBase {
  command: "RNIDE_get_state";
}
interface UpdateStateCommand extends EventBase {
  command: "RNIDE_update_state";
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
interface UpdateStateArgs {
  callId: string;
  state: string;
}

type CallEvent = CallCommand & CallArgs;
type GetStateEvent = GetStateCommand & GetStateArgs;
type UpdateStateEvent = UpdateStateCommand & UpdateStateArgs;

export type WebviewEvent = CallEvent | GetStateEvent | UpdateStateEvent;

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
      ["Project", () => this.ide.project as object],
      ["AppRootConfig", () => this.ide.project.appRootConfigController as object],
      [
        "RenderOutlines",
        () => this.ide.project.deviceSession!.getPlugin(RENDER_OUTLINES_PLUGIN_ID) as object,
      ],
    ]);

    commands.executeCommand("setContext", "RNIDE.panelIsOpen", true);

    const panelLocation = workspace
      .getConfiguration("RadonIDE")
      .get<PanelLocation>("userInterface.panelLocation");

    getTelemetryReporter().sendTelemetryEvent("panelOpened", {
      panelLocation,
    });
  }

  public onStateUpdated = (partialState: RecursivePartial<State>) => {
    this.webview.postMessage({
      command: "RNIDE_state_updated",
      state: StateSerializer.serialize(partialState),
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
        } else if (message.command === "RNIDE_update_state") {
          this.handleUpdateState(message);
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
      try {
        // @ts-ignore
        const result = callableObject[method](...argsWithCallbacks);
        if (result instanceof Promise) {
          result.then((res) => {
            this.webview.postMessage({
              command: "callResult",
              callId,
              result: res,
            });
          });
        } else {
          this.webview.postMessage({
            command: "callResult",
            callId,
            result,
          });
        }
      } catch (error: any) {
        const errorClassName = error?.constructor?.name;
        this.webview.postMessage({
          command: "callResult",
          callId,
          error: { name: error.name, message: error.message, className: errorClassName },
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

  private async handleUpdateState(message: UpdateStateArgs) {
    await this.ide.updateState(StateSerializer.deserialize(message.state));
  }
}
