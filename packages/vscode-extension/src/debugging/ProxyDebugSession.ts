import fs from "fs";
import path from "path";
import os from "os";
import { DebugSession, ErrorDestination, Event } from "@vscode/debugadapter";
import * as vscode from "vscode";
import { DebugProtocol } from "@vscode/debugprotocol";
import { debug, Disposable } from "vscode";
import { CDPProxy } from "./CDPProxy";
import { RadonCDPProxyDelegate } from "./RadonCDPProxyDelegate";
import { disposeAll } from "../utilities/disposables";
import { DEBUG_PAUSED, DEBUG_RESUMED } from "./DebugSession";

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
        this.sendEvent(new Event(DEBUG_PAUSED));
      })
    );
    this.disposables.push(
      proxyDelegate.onDebuggerResumed(() => {
        this.sendEvent(new Event(DEBUG_RESUMED));
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

    let didStartSessionHandler: Disposable | null = vscode.debug.onDidStartDebugSession(
      (session) => {
        if (session.type === CHILD_SESSION_TYPE) {
          this.nodeDebugSession = session;
          didStartSessionHandler?.dispose();
          didStartSessionHandler = null;
        }
      }
    );

    try {
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
        this.sendErrorResponse(
          response,
          { format: "Failed to attach debugger session", id: 1 },
          undefined,
          undefined,
          ErrorDestination.User
        );
      }

      console.assert(this.nodeDebugSession !== null);
      this.sendResponse(response);
    } finally {
      didStartSessionHandler?.dispose();
    }
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
    this.sendEvent(new Event("RNIDE_continued"));
    this.sendResponse(response);
  }

  private terminate() {
    this.cdpProxy.stopServer();
    disposeAll(this.disposables);
    vscode.commands.executeCommand("workbench.action.debug.stop", undefined, {
      sessionId: this.session.id,
    });
  }

  private async ping() {
    try {
      const res = await this.cdpProxy.injectDebuggerCommand({
        method: "Runtime.evaluate",
        params: {
          expression: "('ping')",
        },
      });
      if (!res || "error" in res) {
        return;
      }
      const { result } = res;
      if ("value" in result && result.value === "ping") {
        this.sendEvent(new Event("RNIDE_pong"));
      }
    } catch (_) {
      /** debugSession is waiting for an event, if it won't get any it will fail after timeout, so we don't need to do anything here */
    }
  }

  protected async customRequest(
    command: string,
    response: DebugProtocol.Response,
    args: any,
    request?: DebugProtocol.Request | undefined
  ) {
    switch (command) {
      case "RNIDE_startProfiling":
        await this.cdpProxy.injectDebuggerCommand({ method: "Profiler.start", params: {} });
        this.sendEvent(new Event("RNIDE_profilingCPUStarted"));

        break;
      case "RNIDE_stopProfiling":
        const result = await this.cdpProxy.injectDebuggerCommand({
          method: "Profiler.stop",
          params: {},
        });

        if (!result || "error" in result || !("profile" in result.result)) {
          const error =
            result && "error" in result ? result.error : new Error("Failed to save profile");
          throw error;
        }

        const fileName = `profile-${Date.now()}.cpuprofile`;
        const filePath = path.join(os.tmpdir(), fileName);
        const profile = result.result.profile;
        await fs.promises.writeFile(filePath, JSON.stringify(profile));
        this.sendEvent(new Event("RNIDE_profilingCPUStopped", { filePath }));

        break;
      case "RNIDE_ping":
        this.ping();
        break;
    }
    this.sendResponse(response);
  }
}
