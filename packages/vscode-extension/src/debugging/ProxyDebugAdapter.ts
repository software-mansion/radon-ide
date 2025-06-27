import fs from "fs";
import assert from "assert";
import { DebugSession, ErrorDestination, Event } from "@vscode/debugadapter";
import * as vscode from "vscode";
import { DebugProtocol } from "@vscode/debugprotocol";
import { Disposable } from "vscode";
import { CDPProxy } from "./CDPProxy";
import { RadonCDPProxyDelegate } from "./RadonCDPProxyDelegate";
import { disposeAll } from "../utilities/disposables";
import { DEBUG_CONSOLE_LOG, DEBUG_PAUSED, DEBUG_RESUMED } from "./DebugSession";
import { CDPProfile } from "./cdp";
import { annotateLocations, filePathForProfile } from "./cpuProfiler";
import { SourceMapsRegistry } from "./SourceMapsRegistry";
import { startDebugging } from "./startDebugging";
import { Logger } from "../Logger";

export class ProxyDebugSessionAdapterDescriptorFactory
  implements vscode.DebugAdapterDescriptorFactory
{
  createDebugAdapterDescriptor(
    session: vscode.DebugSession
  ): vscode.ProviderResult<vscode.DebugAdapterDescriptor> {
    return new vscode.DebugAdapterInlineImplementation(new ProxyDebugAdapter(session));
  }
}

// strip the wildcard `*` from the sourceMapPathOverrides before passing them to the SourceMapsRegistry
function sourceMapAliasesFromPathOverrides(
  sourceMapPathOverrides: Record<string, string>
): [string, string][] {
  return Object.entries(sourceMapPathOverrides).map(([key, value]): [string, string] => {
    if (key.endsWith("*")) {
      key = key.slice(0, -1);
    }
    if (value.endsWith("*")) {
      value = value.slice(0, -1);
    }
    return [key, value];
  });
}

const CHILD_SESSION_TYPE = "radon-pwa-node";

export class ProxyDebugAdapter extends DebugSession {
  private cdpProxy: CDPProxy;
  private disposables: Disposable[] = [];
  private nodeDebugSession: vscode.DebugSession | null = null;
  private terminated: boolean = false;
  private sourceMapRegistry: SourceMapsRegistry;

  constructor(private session: vscode.DebugSession) {
    super();

    const sourceMapAliases = sourceMapAliasesFromPathOverrides(
      this.session.configuration.sourceMapPathOverrides
    );
    this.sourceMapRegistry = new SourceMapsRegistry(
      this.session.configuration.expoPreludeLineCount,
      sourceMapAliases
    );

    const proxyDelegate = new RadonCDPProxyDelegate(
      this.sourceMapRegistry,
      this.session.configuration.skipFiles,
      this.session.configuration.installConnectRuntime
    );

    this.cdpProxy = new CDPProxy(
      "127.0.0.1",
      this.session.configuration.websocketAddress,
      proxyDelegate
    );

    this.disposables.push(
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
      })
    );
    this.disposables.push(
      proxyDelegate.onDebuggerResumed(() => {
        this.sendEvent(new Event(DEBUG_RESUMED));
        if (this.session.configuration.displayDebuggerOverlay) {
          this.cdpProxy.injectDebuggerCommand({
            method: "Overlay.setPausedInDebuggerMessage",
            params: {},
          });
        }
      })
    );
    this.disposables.push(
      proxyDelegate.onConsoleAPICalled(() => {
        this.sendEvent(new Event(DEBUG_CONSOLE_LOG));
      })
    );

    this.disposables.push(
      vscode.debug.onDidTerminateDebugSession(({ id }) => {
        if (id === this.nodeDebugSession?.id) {
          this.terminate();
        }
      })
    );

    this.disposables.push(
      proxyDelegate.onBindingCalled(({ name, payload }) => {
        this.sendEvent(new Event("RNIDE_bindingCalled", { name, payload }));
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
    args: DebugProtocol.AttachRequestArguments & {
      sourceMapPathOverrides: Record<string, string>;
      websocketAddress: string;
    },
    request?: DebugProtocol.Request
  ) {
    await this.cdpProxy.initializeServer();

    try {
      this.nodeDebugSession = await startDebugging(
        undefined,
        {
          type: CHILD_SESSION_TYPE,
          name: `${this.session.name} (JS)`,
          request: "attach",
          port: this.cdpProxy.port!,
          continueOnAttach: true,
          sourceMapPathOverrides: args.sourceMapPathOverrides,
          resolveSourceMapLocations: ["**", "!**/node_modules/!(expo)/**"],
          // NOTE: setting skipFiles increases startup time _significantly_, so we omit them until we figure out
          // how to work around this problem
          skipFiles: [],
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
        }
      );
      this.sendResponse(response);
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
    this.terminated = true;
    await this.cdpProxy.stopServer();
    disposeAll(this.disposables);
    await vscode.commands.executeCommand("workbench.action.debug.stop", undefined, {
      sessionId: this.session.id,
    });
  }

  private async ping() {
    try {
      const response = await this.cdpProxy.injectDebuggerCommand({
        method: "Runtime.evaluate",
        params: {
          expression: "('ping')",
        },
      });
      if (
        !("result" in response) ||
        typeof response.result !== "object" ||
        response.result === null
      ) {
        return false;
      }
      const result = response.result;
      if ("value" in result && result.value === "ping") {
        return true;
      }
    } catch (_) {
      /** debugSession is waiting for an event, if it won't get any it will fail after timeout, so we don't need to do anything here */
    }
    return false;
  }

  private async startProfiling() {
    await this.cdpProxy.injectDebuggerCommand({ method: "Profiler.start", params: {} });
    this.sendEvent(new Event("RNIDE_profilingCPUStarted"));
  }

  private async stopProfiling() {
    const result = await this.cdpProxy.injectDebuggerCommand({
      method: "Profiler.stop",
      params: {},
    });

    assert("profile" in result, "Profiler.stop response should contain a profile");

    const profile = annotateLocations(result.profile as CDPProfile, this.sourceMapRegistry);
    const filePath = filePathForProfile();
    await fs.promises.writeFile(filePath, JSON.stringify(profile));
    this.sendEvent(new Event("RNIDE_profilingCPUStopped", { filePath }));
  }

  private async postMessage(args: any) {
    this.cdpProxy.injectDebuggerCommand({
      method: "Runtime.evaluate",
      params: {
        expression: `globalThis.__radon_dispatch(${JSON.stringify(args)});`,
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
      case "RNIDE_postMessage":
        await this.postMessage(args);
        break;
      case "RNIDE_ping":
        response.body.result = await this.ping();
        break;
    }
    this.sendResponse(response);
  }
}
