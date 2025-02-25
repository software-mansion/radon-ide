import { DebugSession, ErrorDestination, Event } from "@vscode/debugadapter";
import * as vscode from "vscode";
import { DebugProtocol } from "@vscode/debugprotocol";
import { debug, Disposable } from "vscode";
import { CDPProxy } from "./CDPProxy";
import { RadonCDPProxyDelegate } from "./RadonCDPProxyDelegate";

export class ProxyDebugSessionAdapterDescriptorFactory
  implements vscode.DebugAdapterDescriptorFactory
{
  createDebugAdapterDescriptor(
    session: vscode.DebugSession
  ): vscode.ProviderResult<vscode.DebugAdapterDescriptor> {
    return new vscode.DebugAdapterInlineImplementation(new ProxyDebugSession(session));
  }
}

export class ProxyDebugSession extends DebugSession {
  private websocketAddress: string;
  private sourceMapPathOverrides: Record<string, string>;

  private cdpProxy: CDPProxy;
  private disposables: Disposable[] = [];

  constructor(private session: vscode.DebugSession) {
    super();
    this.websocketAddress = session.configuration.websocketAddress;
    this.sourceMapPathOverrides = session.configuration.sourceMapPathOverrides;

    const cdpProxyPort = Math.round(Math.random() * 40000 + 3000);
    const proxyDelegate = new RadonCDPProxyDelegate();

    this.cdpProxy = new CDPProxy("127.0.0.1", cdpProxyPort, this.websocketAddress, proxyDelegate);

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

    const childSessionStarted = await debug.startDebugging(
      undefined,
      {
        type: "radon-pwa-node",
        name: "Radon IDE Debugger",
        request: "attach",
        port: this.cdpProxy.port,
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
      }
    );

    if (!childSessionStarted) {
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
}
