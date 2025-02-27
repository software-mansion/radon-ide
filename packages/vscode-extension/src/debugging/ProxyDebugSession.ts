import { DebugSession, ErrorDestination, Event } from "@vscode/debugadapter";
import * as vscode from "vscode";
import { DebugProtocol } from "@vscode/debugprotocol";
import { debug, Disposable } from "vscode";
import { CDPProxy } from "./CDPProxy";
import { RadonCDPProxyDelegate } from "./RadonCDPProxyDelegate";
import { disposeAll } from "../utilities/disposables";

export class ProxyDebugSessionAdapterDescriptorFactory
  implements vscode.DebugAdapterDescriptorFactory
{
  createDebugAdapterDescriptor(
    session: vscode.DebugSession
  ): vscode.ProviderResult<vscode.DebugAdapterDescriptor> {
    return new vscode.DebugAdapterInlineImplementation(new ProxyDebugSession(session));
  }
}

const CHILD_SESSION_TYPE = "radon-pwa-node";

export class ProxyDebugSession extends DebugSession {
  private cdpProxy: CDPProxy;
  private disposables: Disposable[] = [];
  private nodeDebugSession: vscode.DebugSession | null = null;

  constructor(private session: vscode.DebugSession) {
    super();

    const cdpProxyPort = Math.round(Math.random() * 40000 + 3000);
    const proxyDelegate = new RadonCDPProxyDelegate();

    this.cdpProxy = new CDPProxy(
      "127.0.0.1",
      cdpProxyPort,
      session.configuration.websocketAddress,
      proxyDelegate
    );

    this.disposables.push(
      proxyDelegate.onDebuggerPaused(() => {
        this.sendEvent(new Event("RNIDE_paused"));
      })
    );
    this.disposables.push(
      proxyDelegate.onDebuggerResumed(() => {
        this.sendEvent(new Event("RNIDE_continued"));
      })
    );
    this.disposables.push(
      proxyDelegate.onDebuggerReady(() => {
        // this.sendEvent(new Event("RNIDE_continued"));
      })
    );
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
    args: any,
    request?: DebugProtocol.Request
  ) {
    await this.cdpProxy.initializeServer();

    const unsub = vscode.debug.onDidStartDebugSession((session) => {
      if (session.type === CHILD_SESSION_TYPE) {
        this.nodeDebugSession = session;
        unsub.dispose();
      }
    });

    const childSessionStarted = await debug.startDebugging(
      undefined,
      {
        type: CHILD_SESSION_TYPE,
        name: "Radon IDE Debugger",
        request: "attach",
        port: this.cdpProxy.port,
        continueOnAttach: true,
        sourceMapPathOverrides: args.sourceMapPathOverrides,
        resolveSourceMapLocations: ["**", "!**/node_modules/!(expo)/**"],
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
      }
    );

    if (!childSessionStarted) {
      console.assert(this.nodeDebugSession !== null);
      this.sendErrorResponse(
        response,
        { format: "Failed to attach debugger session", id: 1 },
        undefined,
        undefined,
        ErrorDestination.User
      );
    }

    this.sendResponse(response);
  }

  protected continueRequest(
    response: DebugProtocol.ContinueResponse,
    args: DebugProtocol.ContinueArguments,
    request?: DebugProtocol.Request
  ): void {
    if (!this.nodeDebugSession) {
      return;
    }
    vscode.commands.executeCommand("workbench.action.debug.continue", undefined, {
      sessionId: this.nodeDebugSession.id,
    });
  }

  protected nextRequest(
    response: DebugProtocol.NextResponse,
    args: DebugProtocol.NextArguments,
    request?: DebugProtocol.Request
  ): void {
    if (!this.nodeDebugSession) {
      return;
    }
    vscode.commands.executeCommand("workbench.action.debug.stepOver", undefined, {
      sessionId: this.nodeDebugSession.id,
    });
  }

  protected async disconnectRequest(
    response: DebugProtocol.DisconnectResponse,
    args: DebugProtocol.DisconnectArguments,
    request?: DebugProtocol.Request
  ) {
    this.terminate();
    this.sendResponse(response);
  }

  private terminate() {
    this.cdpProxy.stopServer();
    disposeAll(this.disposables);
    vscode.commands.executeCommand("workbench.action.debug.stop", undefined, {
      sessionId: this.session.id,
    });
  }
}
