import fs from "fs";
import path from "path";
import os from "os";
import { DebugConfiguration } from "vscode";
import {
  DebugSession,
  InitializedEvent,
  StoppedEvent,
  Event,
  ContinuedEvent,
  OutputEvent,
  Thread,
  TerminatedEvent,
  ThreadEvent,
  StackFrame,
} from "@vscode/debugadapter";
import { DebugProtocol } from "@vscode/debugprotocol";
import { Logger } from "../Logger";
import {
  inferDAPScopePresentationHintFromCDPType,
  inferDAPVariableValueForCDPRemoteObject,
  CDPDebuggerScope,
} from "./cdp";
import { CDPSession, CDPSessionDelegate } from "./CDPSession";
import getArraySlots from "./templates/getArraySlots";

export type CDPConfiguration = {
  websocketAddress: string;
  expoPreludeLineCount: number;
  sourceMapAliases: [string, string][];
  breakpointsAreRemovedOnContextCleared: boolean;
};

const ERROR_RESPONSE_FAIL_TO_RETRIEVE_VARIABLE_ID = 4000;

export class CDPDebugAdapter extends DebugSession implements CDPSessionDelegate {
  private cdpSession: CDPSession | undefined;

  private threads: Array<Thread> = [];

  private pausedStackFrames: StackFrame[] = [];
  private pausedScopeChains: CDPDebuggerScope[][] = [];

  constructor(configuration: DebugConfiguration) {
    super();
    console.assert(
      "websocketAddress" in configuration,
      "CDPDebugSession requires websocketAddress"
    );
    this.startCDPSession(configuration as unknown as CDPConfiguration);
  }

  private startCDPSession(cdpConfiguration: CDPConfiguration) {
    this.cdpSession = new CDPSession(
      this,
      cdpConfiguration.websocketAddress,
      {
        expoPreludeLineCount: cdpConfiguration.expoPreludeLineCount,
        sourceMapAliases: cdpConfiguration.sourceMapAliases,
      },
      {
        breakpointsAreRemovedOnContextCleared:
          cdpConfiguration.breakpointsAreRemovedOnContextCleared,
      }
    );
  }
  //#region CDPDelegate

  public onExecutionContextCreated = (threadId: number, threadName: string) => {
    this.sendEvent(new ThreadEvent("started", threadId));
    this.threads.push(new Thread(threadId, threadName));
  };

  public onConnectionClosed = () => {
    this.sendEvent(new TerminatedEvent());
  };

  public onDebugSessionReady = () => {
    this.sendEvent(new InitializedEvent());
  };

  public onDebuggerPaused = (message: any) => {};

  public onDebuggerResumed = () => {
    this.sendEvent(new ContinuedEvent(this.threads[0].id));
  };

  public onExecutionContextsCleared = () => {
    const allThreads = this.threads;
    this.threads = [];
    // send events for all threads that exited
    allThreads.forEach((thread) => {
      this.sendEvent(new ThreadEvent("exited", thread.id));
    });

    // send event to clear console
    this.sendEvent(new OutputEvent("\x1b[2J", "console"));
  };

  public sendOutputEvent = (output: OutputEvent) => {
    this.sendEvent(output);
    this.sendEvent(new Event("RNIDE_consoleLog", { category: output.body.category }));
  };

  public sendStoppedEvent = (
    pausedStackFrames: StackFrame[],
    pausedScopeChains: CDPDebuggerScope[][],
    reason: string,
    exceptionText?: string,
    isFatal?: string
  ) => {
    this.pausedStackFrames = pausedStackFrames;
    this.pausedScopeChains = pausedScopeChains;

    this.sendEvent(new StoppedEvent(reason, this.threads[0].id, exceptionText));
    this.sendEvent(new Event("RNIDE_paused", { reason, isFatal }));
  };

  //#endregion

  //#region DAP Implementation

  protected initializeRequest(
    response: DebugProtocol.InitializeResponse,
    args: DebugProtocol.InitializeRequestArguments
  ): void {
    response.body = response.body || {};

    this.sendResponse(response);
  }

  protected launchRequest(
    response: DebugProtocol.LaunchResponse,
    args: DebugProtocol.LaunchRequestArguments
  ): void {
    // Implement launching the debugger
    this.sendResponse(response);
  }

  protected async setBreakPointsRequest(
    response: DebugProtocol.SetBreakpointsResponse,
    args: DebugProtocol.SetBreakpointsArguments
  ): Promise<void> {
    if (!this.cdpSession) {
      Logger.warn("[DebugAdapter] [setBreakPointsRequest] The CDPSession was not initialized yet");
      this.sendResponse(response);
      return;
    }

    const sourcePath = args.source.path;
    if (!sourcePath) {
      this.sendResponse(response);
      return;
    }

    const resolvedBreakpoints = await this.cdpSession.handleSetBreakpointRequest(
      sourcePath,
      args.breakpoints
    );

    // send back the actual breakpoint positions
    response.body = {
      breakpoints: resolvedBreakpoints,
    };
    this.sendResponse(response);
  }

  protected threadsRequest(response: DebugProtocol.ThreadsResponse): void {
    response.body = {
      threads: this.threads,
    };
    this.sendResponse(response);
  }

  protected stackTraceRequest(
    response: DebugProtocol.StackTraceResponse,
    args: DebugProtocol.StackTraceArguments
  ): void {
    response.body = response.body || {};
    response.body.stackFrames = this.pausedStackFrames;
    this.sendResponse(response);
  }

  protected async scopesRequest(
    response: DebugProtocol.ScopesResponse,
    args: DebugProtocol.ScopesArguments
  ): Promise<void> {
    if (!this.cdpSession) {
      Logger.warn("[DebugAdapter] [scopesRequest] The CDPSession was not initialized yet");
      this.sendResponse(response);
      return;
    }

    response.body = response.body || {};

    response.body.scopes =
      this.pausedScopeChains[args.frameId]?.map((scope) => ({
        name: scope.type === "closure" ? "CLOSURE" : scope.name || scope.type.toUpperCase(), // for closure type, names are just numbers, so they don't look good, instead we just use name "CLOSURE"
        variablesReference: this.cdpSession!.adaptCDPObjectId(scope.object.objectId),
        presentationHint: inferDAPScopePresentationHintFromCDPType(scope.type),
        expensive: scope.type !== "local", // we only mark local scope as non-expensive as it is the one typically people want to look at and shouldn't have too many objects
      })) || [];
    this.sendResponse(response);
  }

  protected async sourceRequest(
    response: DebugProtocol.Response & {
      body: {
        sourceURL: string;
        lineNumber1Based: number;
        columnNumber0Based: number;
        scriptURL: string;
      };
    },
    args: DebugProtocol.SourceArguments & {
      fileName: string;
      line0Based: number;
      column0Based: number;
    },
    request?: DebugProtocol.Request
  ) {
    if (!this.cdpSession) {
      Logger.warn("[DebugAdapter] [sourceRequest] The CDPSession was not initialized yet");
      this.sendResponse(response);
      return;
    }

    response.body = {
      ...this.cdpSession.findOriginalPosition(args.fileName, args.line0Based, args.column0Based),
    };
    this.sendResponse(response);
  }

  protected async variablesRequest(
    response: DebugProtocol.Response,
    args: DebugProtocol.VariablesArguments
  ): Promise<void> {
    if (!this.cdpSession) {
      Logger.warn("[DebugAdapter] [variablesRequest] The CDPSession was not initialized yet");
      this.sendResponse(response);
      return;
    }

    response.body = response.body || {};
    response.body.variables = [];

    try {
      if (args.filter !== "indexed" && args.filter !== "named") {
        response.body.variables = await this.cdpSession.getVariable(args.variablesReference);
      } else if (args.filter === "indexed") {
        const stringified = "" + getArraySlots;

        const partialValue = await this.cdpSession!.sendCDPMessage("Runtime.callFunctionOn", {
          functionDeclaration: stringified,
          objectId: this.cdpSession.convertDAPObjectIdToCDP(args.variablesReference),
          arguments: [args.start, args.count].map((value) => ({ value })),
        });

        const properties = await this.cdpSession.getVariable(
          this.cdpSession.adaptCDPObjectId(partialValue.result.objectId)
        );

        response.body.variables = properties;
      } else if (args.filter === "named") {
        // We do nothing for named variables. We set 'named' and 'indexed' only for arrays in variableStore
        // so the 'named' here means "display chunks" (which is handled by Debugger). If we'd get the properties
        // here we would get all indexed properties even when passing `nonIndexedPropertiesOnly: true` param
        // to Runtime.getProperties. I assume that this property just does not work yet as it's marked as experimental.
      }
    } catch (e) {
      Logger.error("[CDP] Failed to retrieve variable", e);
      response.success = false;
      response.body.error = {
        id: ERROR_RESPONSE_FAIL_TO_RETRIEVE_VARIABLE_ID,
        format: "Failed to retrieve variable",
      };
    }

    this.sendResponse(response);
  }

  protected async continueRequest(
    response: DebugProtocol.ContinueResponse,
    args: DebugProtocol.ContinueArguments
  ): Promise<void> {
    if (!this.cdpSession) {
      Logger.warn("[DebugAdapter] [continueRequest] The CDPSession was not initialized yet");
      this.sendResponse(response);
      return;
    }

    await this.cdpSession.sendCDPMessage("Debugger.resume", { terminateOnResume: false });
    this.sendResponse(response);
    this.sendEvent(new Event("RNIDE_continued"));
  }

  protected async nextRequest(
    response: DebugProtocol.NextResponse,
    args: DebugProtocol.NextArguments
  ): Promise<void> {
    if (!this.cdpSession) {
      Logger.warn("[DebugAdapter] [nextRequest] The CDPSession was not initialized yet");
      this.sendResponse(response);
      return;
    }

    await this.cdpSession.sendCDPMessage("Debugger.stepOver", {});
    this.sendResponse(response);
  }

  protected disconnectRequest(
    response: DebugProtocol.DisconnectResponse,
    args: DebugProtocol.DisconnectArguments
  ): void {
    if (!this.cdpSession) {
      Logger.warn("[DebugAdapter] [disconnectRequest] The CDPSession was not initialized yet");
      this.sendResponse(response);
      return;
    }

    this.cdpSession.closeConnection();
    this.sendResponse(response);
  }

  protected async evaluateRequest(
    response: DebugProtocol.EvaluateResponse,
    args: DebugProtocol.EvaluateArguments
  ): Promise<void> {
    if (!this.cdpSession) {
      Logger.warn("[DebugAdapter] [evaluateRequest] The CDPSession was not initialized yet");
      this.sendResponse(response);
      return;
    }

    const cdpResponse = await this.cdpSession!.sendCDPMessage("Runtime.evaluate", {
      expression: args.expression,
    });
    const remoteObject = cdpResponse.result;
    const stringValue = inferDAPVariableValueForCDPRemoteObject(remoteObject);

    response.body = response.body || {};
    response.body.result = stringValue;
    response.body.variablesReference = 0;
    if (remoteObject.type === "object") {
      const dapID = this.cdpSession.adaptCDPObjectId(remoteObject.objectId);
      response.body.type = "object";
      response.body.variablesReference = dapID;
    }
    this.sendResponse(response);
  }

  protected async customRequest(
    command: string,
    response: DebugProtocol.Response,
    args: any,
    request?: DebugProtocol.Request | undefined
  ) {
    switch (command) {
      case "RNIDE_startProfiling":
        if (this.cdpSession) {
          await this.cdpSession.startProfiling();
          this.sendEvent(new Event("RNIDE_profilingCPUStarted"));
        }
        break;
      case "RNIDE_stopProfiling":
        if (this.cdpSession) {
          const profile = await this.cdpSession.stopProfiling();
          const fileName = `profile-${Date.now()}.cpuprofile`;
          const filePath = path.join(os.tmpdir(), fileName);
          await fs.promises.writeFile(filePath, JSON.stringify(profile));
          this.sendEvent(new Event("RNIDE_profilingCPUStopped", { filePath }));
        }
        break;
      default:
        Logger.debug(`Custom req ${command} ${args}`);
    }
    this.sendResponse(response);
  }

  //#endregion
}
