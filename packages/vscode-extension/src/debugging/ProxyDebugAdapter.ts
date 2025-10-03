import { DebugSession, ErrorDestination, Event } from "@vscode/debugadapter";
import * as vscode from "vscode";
import { DebugProtocol } from "@vscode/debugprotocol";
import { Disposable, debug } from "vscode";
import { CDPProxy } from "./CDPProxy";
import { RadonCDPProxyDelegate } from "./RadonCDPProxyDelegate";
import { disposeAll } from "../utilities/disposables";
import {
  BINDING_CALLED,
  DEBUG_CONSOLE_LOG,
  DEBUG_PAUSED,
  DEBUG_RESUMED,
  SCRIPT_PARSED,
  RNIDE_NETWORK_EVENT,
  RNIDE_NetworkMethod,
} from "./DebugSession";
import { startDebugging } from "./startDebugging";
import { Logger } from "../Logger";
import { CancelToken } from "../utilities/cancelToken";
import { NetworkMethod } from "../network/types/panelMessageProtocol";
import { NetworkBridgeGetResponseBodyArgs } from "../project/bridge";

export class ProxyDebugSessionAdapterDescriptorFactory
  implements vscode.DebugAdapterDescriptorFactory
{
  createDebugAdapterDescriptor(
    session: vscode.DebugSession
  ): vscode.ProviderResult<vscode.DebugAdapterDescriptor> {
    return new vscode.DebugAdapterInlineImplementation(new ProxyDebugAdapter(session));
  }
}

const CHILD_SESSION_TYPE = "radon-pwa-node";

export class ProxyDebugAdapter extends DebugSession {
  private cdpProxy: CDPProxy;
  private disposables: Disposable[] = [];
  private childDebugSession: vscode.DebugSession | null = null;
  private attachCancelToken = new CancelToken();
  private terminated: boolean = false;
  private attached: boolean = false;
  private eventsQueue: Event[] = [];

  constructor(private session: vscode.DebugSession) {
    super();

    const proxyDelegate = new RadonCDPProxyDelegate();

    this.cdpProxy = new CDPProxy(
      "127.0.0.1",
      this.session.configuration.websocketAddress,
      proxyDelegate
    );

    this.setupListeners(proxyDelegate);
  }

  private setupListeners(proxyDelegate: RadonCDPProxyDelegate) {
    const subscriptions = [
      proxyDelegate.onDebuggerPaused(({ reason }) => {
        this.sendEvent(new Event(DEBUG_PAUSED, { reason }));
        if (this.session.configuration.displayDebuggerOverlay) {
          this.cdpProxy.injectDebuggerCommand({
            method: "Overlay.setPausedInDebuggerMessage",
            params: {
              message: "Paused in debugger",
            },
          });
        }
      }),
      proxyDelegate.onDebuggerResumed(() => {
        this.sendEvent(new Event(DEBUG_RESUMED));
        if (this.session.configuration.displayDebuggerOverlay) {
          this.cdpProxy.injectDebuggerCommand({
            method: "Overlay.setPausedInDebuggerMessage",
            params: {},
          });
        }
      }),
      proxyDelegate.onConsoleAPICalled(() => {
        this.sendEvent(new Event(DEBUG_CONSOLE_LOG));
      }),
      vscode.debug.onDidTerminateDebugSession((terminatedSession) => {
        if (terminatedSession.parentSession?.id === this.session.id) {
          this.terminate();
        }
      }),
      proxyDelegate.onBindingCalled(({ name, payload }) => {
        this.sendEvent(new Event(BINDING_CALLED, { name, payload }));
      }),
      proxyDelegate.onBundleParsed(({ isMainBundle }) => {
        this.sendEvent(new Event(SCRIPT_PARSED, { isMainBundle }));
      }),
      debug.onDidReceiveDebugSessionCustomEvent((event) => {
        if (event.session.id !== this.childDebugSession?.id) {
          return;
        }
        switch (event.event) {
          case "profileStarted":
            this.sendEvent(new Event("RNIDE_profilingCPUStarted"));
            break;
          case "profilerStateUpdate":
            if (event.body?.running === false) {
              this.sendEvent(new Event("RNIDE_profilingCPUStopped"));
            }
            break;
        }
      }),
      proxyDelegate.onNetworkEvent((e) => {
        this.sendEvent(new Event(RNIDE_NETWORK_EVENT, e));
      }),
    ];

    this.disposables.push(...subscriptions);
  }

  public sendEvent(event: Event) {
    if (this.attached) {
      super.sendEvent(event);
    } else {
      this.eventsQueue.push(event);
    }
  }

  private flushEventsQueue() {
    this.eventsQueue.forEach((event) => super.sendEvent(event));
    this.eventsQueue = [];
  }

  protected initializeRequest(
    response: DebugProtocol.InitializeResponse,
    args: DebugProtocol.InitializeRequestArguments
  ): void {
    response.body = response.body || {};

    response.body.supportsConfigurationDoneRequest = true;
    response.body.supportsEvaluateForHovers = true;
    response.body.supportTerminateDebuggee = false;
    response.body.supportsCancelRequest = true;

    response.body.exceptionBreakpointFilters = [
      {
        filter: "all",
        label: "Caught Exceptions",
        default: false,
        supportsCondition: true,
        description: "Breaks on all throw errors, even if they're caught later.",
        conditionDescription: 'error.name == "MyError"',
      },
      {
        filter: "uncaught",
        label: "Uncaught Exceptions",
        default: false,
        supportsCondition: true,
        description: "Breaks only on errors or promise rejections that are not handled.",
        conditionDescription: 'error.name == "MyError"',
      },
    ];

    this.sendResponse(response);
  }

  protected async attachRequest(
    response: DebugProtocol.AttachResponse,
    args: DebugProtocol.AttachRequestArguments & {
      sourceMapPathOverrides: Record<string, string>;
      websocketAddress: string;
    },
    request?: DebugProtocol.Request
  ) {
    await this.cdpProxy.initializeServer();

    try {
      const vscDebugSession = await startDebugging(
        undefined,
        {
          type: CHILD_SESSION_TYPE,
          name: `${this.session.name} (JS)`,
          request: "attach",
          port: this.cdpProxy.port!,
          continueOnAttach: true,
          sourceMapPathOverrides: args.sourceMapPathOverrides,
          resolveSourceMapLocations: ["**", "!**/node_modules/!(expo)/**"],
          skipFiles: this.session.configuration.skipFiles,
          outFiles: [],
        },
        {
          suppressDebugStatusbar: true,
          suppressDebugView: true,
          suppressDebugToolbar: true,
          suppressSaveBeforeStart: true,
          parentSession: this.session,
          consoleMode: vscode.DebugConsoleMode.MergeWithParent,
          lifecycleManagedByParent: true,
          compact: true,
        },
        this.attachCancelToken
      );

      // vscode-js-debug spawns another child session that corresponds to the actual
      // CDP debugger session. We need to use that session to send commands to control
      // the profiling.
      const { promise, resolve, reject } = Promise.withResolvers<void>();
      this.attachCancelToken.onCancel(reject);
      const onDidStartDisposable = debug.onDidStartDebugSession((session) => {
        if (session.parentSession?.id === vscDebugSession.id) {
          this.childDebugSession = session;
          resolve();
        }
      });
      promise.finally(() => onDidStartDisposable.dispose());
      await promise;

      this.sendResponse(response);
      this.attached = true;
      this.flushEventsQueue();
    } catch (e) {
      Logger.error("Error starting proxy debug adapter child session", e);
      this.sendErrorResponse(
        response,
        { format: "Failed to attach debugger session", id: 1 },
        undefined,
        undefined,
        ErrorDestination.User
      );
    }
  }

  protected continueRequest(
    response: DebugProtocol.ContinueResponse,
    args: DebugProtocol.ContinueArguments,
    request?: DebugProtocol.Request
  ): void {
    if (!this.childDebugSession) {
      return;
    }
    vscode.commands.executeCommand("workbench.action.debug.continue", undefined, {
      sessionId: this.childDebugSession.id,
    });
  }

  protected async disconnectRequest(
    response: DebugProtocol.DisconnectResponse,
    args: DebugProtocol.DisconnectArguments,
    request?: DebugProtocol.Request
  ) {
    await this.terminate();
    // since the application resumes once the debugger is disconnected, we need to send a continued event
    // to the frontend to update the UI
    this.sendEvent(new Event("RNIDE_continued"));
    this.sendResponse(response);
  }

  private async terminate() {
    if (this.terminated) {
      return;
    }
    this.attachCancelToken.cancel();
    this.attached = false;
    this.terminated = true;
    await this.cdpProxy.stopServer();
    disposeAll(this.disposables);
    await vscode.commands.executeCommand("workbench.action.debug.stop", undefined, {
      sessionId: this.session.id,
    });
  }

  private async startProfiling() {
    await this.childDebugSession?.customRequest("startProfile", { type: "cpu" });
  }

  private async stopProfiling() {
    await this.childDebugSession?.customRequest("stopProfile");
  }

  private async enableNetworkInspector() {
    await this.cdpProxy.injectDebuggerCommand({ method: NetworkMethod.Enable, params: {} });
  }
  private async disableNetworkInspector() {
    await this.cdpProxy.injectDebuggerCommand({ method: NetworkMethod.Disable, params: {} });
  }
  private async getResponseBody(args: NetworkBridgeGetResponseBodyArgs) {
    try {
      const result = await this.cdpProxy.injectDebuggerCommand({
        method: NetworkMethod.GetResponseBody,
        params: args,
      });
      return result;
    } catch (e) {
      Logger.error("Error fetching response body", e);
      return undefined;
    }
  }

  private async dispatchRadonAgentMessage(args: any) {
    this.cdpProxy.injectDebuggerCommand({
      method: "Runtime.evaluate",
      params: {
        expression: `globalThis.__radon_dispatch(${JSON.stringify(args)});`,
      },
    });
  }

  private async evaluateExpression(params: any) {
    const response = await this.cdpProxy.injectDebuggerCommand({
      method: "Runtime.evaluate",
      params,
    });
    if (
      !("result" in response) ||
      typeof response.result !== "object" ||
      response.result === null
    ) {
      throw new Error("Invalid response from Runtime.evaluate");
    }
    return response.result;
  }

  private async addBinding(name: string) {
    await this.cdpProxy.injectDebuggerCommand({
      method: "Runtime.addBinding",
      params: {
        name,
      },
    });
  }

  protected async customRequest(
    command: string,
    response: DebugProtocol.Response,
    args: any,
    request?: DebugProtocol.Request | undefined
  ) {
    response.body = response.body || {};
    switch (command) {
      case "RNIDE_startProfiling":
        await this.startProfiling();
        break;
      case "RNIDE_stopProfiling":
        await this.stopProfiling();
        break;
      case "RNIDE_dispatchRadonAgentMessage":
        await this.dispatchRadonAgentMessage(args);
        break;
      case "RNIDE_evaluate":
        response.body.result = await this.evaluateExpression(args);
        break;
      case "RNIDE_addBinding":
        await this.addBinding(args.name);
        break;
      case RNIDE_NetworkMethod.Enable:
        await this.enableNetworkInspector();
        break;
      case RNIDE_NetworkMethod.Disable:
        await this.disableNetworkInspector();
        break;
      case RNIDE_NetworkMethod.GetResponseBody:
        response.body.result = await this.getResponseBody(args);
        break;
    }
    this.sendResponse(response);
  }
}
