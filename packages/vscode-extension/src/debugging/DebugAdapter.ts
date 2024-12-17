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
  Source,
  StackFrame,
} from "@vscode/debugadapter";
import { DebugProtocol } from "@vscode/debugprotocol";
import { Cdp } from "vscode-js-debug/out/cdp/index";
import { AnyObject } from "vscode-js-debug/out/adapter/objectPreview/betterTypes";
import {
  messageFormatters,
  previewAsObject,
  previewRemoteObject,
} from "vscode-js-debug/out/adapter/objectPreview";
import { formatMessage } from "vscode-js-debug/out/adapter/messageFormat";
import { Logger } from "../Logger";
import {
  inferDAPScopePresentationHintFromCDPType,
  inferDAPVariableValueForCDPRemoteObject,
  CDPDebuggerScope,
  CDPRemoteObject,
} from "./cdp";
import { VariableStore } from "./variableStore";
import { SourceMapsRegistry } from "./SourceMapsRegistry";
import { BreakpointsController } from "./BreakpointsController";
import { CDPSession } from "./CDPSession";
import getArraySlots from "./templates";

function typeToCategory(type: string) {
  switch (type) {
    case "warning":
    case "error":
      return "stderr";
    default:
      return "stdout";
  }
}

export class DebugAdapter extends DebugSession {
  private variableStore: VariableStore = new VariableStore();

  private cdpSession: CDPSession;
  private sourceMapRegistry: SourceMapsRegistry;

  private breakpointsController: BreakpointsController;

  private threads: Array<Thread> = [];
  private linesStartAt1 = true;
  private columnsStartAt1 = true;

  private pausedStackFrames: StackFrame[] = [];
  private pausedScopeChains: CDPDebuggerScope[][] = [];

  constructor(configuration: DebugConfiguration) {
    super();
    this.cdpSession = new CDPSession(
      configuration.websocketAddress,
      () => {
        this.sendEvent(new TerminatedEvent());
      },
      this.handleIncomingCDPMethodCalls
    );

    this.sourceMapRegistry = new SourceMapsRegistry(
      configuration.expoPreludeLineCount,
      configuration.sourceMapAliases
    );

    this.breakpointsController = new BreakpointsController(
      this.sourceMapRegistry,
      this.cdpSession,
      configuration.breakpointsAreRemovedOnContextCleared
    );
  }

  private handleIncomingCDPMethodCalls = async (message: any) => {
    switch (message.method) {
      case "Runtime.executionContextCreated":
        const context = message.params.context;
        const threadId = context.id;
        const threadName = context.name;
        this.sendEvent(new ThreadEvent("started", threadId));
        this.threads.push(new Thread(threadId, threadName));
        break;
      case "Debugger.scriptParsed":
        const sourceMapURL = message.params.sourceMapURL;

        if (sourceMapURL?.startsWith("data:")) {
          const base64Data = sourceMapURL.split(",")[1];
          const decodedData = Buffer.from(base64Data, "base64").toString("utf-8");
          const sourceMap = JSON.parse(decodedData);

          // We detect when a source map for the entire bundle is loaded by checking if __prelude__ module is present in the sources.
          const isMainBundle = sourceMap.sources.some((source: string) =>
            source.includes("__prelude__")
          );

          const consumer = await this.sourceMapRegistry.registerSourceMap(
            sourceMap,
            message.params.url,
            message.params.scriptId,
            isMainBundle
          );

          if (isMainBundle) {
            this.cdpSession.sendCDPMessage("Runtime.evaluate", {
              expression: "__RNIDE_onDebuggerReady()",
            });
            this.sendEvent(new InitializedEvent());
          }

          this.breakpointsController.updateBreakpointsInSource(message.params.url, consumer);
        }
        break;
      case "Debugger.paused":
        this.handleDebuggerPaused(message);
        break;
      case "Debugger.resumed":
        this.sendEvent(new ContinuedEvent(this.threads[0].id));
        break;
      case "Runtime.executionContextsCleared":
        // clear all existing threads, source maps, and variable store
        const allThreads = this.threads;
        this.threads = [];
        this.sourceMapRegistry.clearSourceMaps();
        this.breakpointsController.onContextCleared();
        this.variableStore.clearReplVariables();
        this.variableStore.clearCDPVariables();

        // send events for all threads that exited
        allThreads.forEach((thread) => {
          this.sendEvent(new ThreadEvent("exited", thread.id));
        });

        // send event to clear console
        this.sendEvent(new OutputEvent("\x1b[2J", "console"));
        break;
      case "Runtime.consoleAPICalled":
        this.handleConsoleAPICall(message);
        break;
      default:
        break;
    }
  };

  // Based on https://github.com/microsoft/vscode-js-debug/blob/3be255753c458f231e32c9ef5c60090236780060/src/adapter/console/textualMessage.ts#L83
  async formatDefaultString(args: ReadonlyArray<Cdp.Runtime.RemoteObject>) {
    const useMessageFormat = args.length > 1 && args[0].type === "string";
    const formatResult = useMessageFormat
      ? formatMessage(args[0].value, args.slice(1) as AnyObject[], messageFormatters)
      : formatMessage("", args as AnyObject[], messageFormatters);

    const output = formatResult.result + "\n";

    if (formatResult.usedAllSubs && !args.some(previewAsObject)) {
      return { output };
    } else {
      const outputVar = await this.createVariableForOutputEvent(args as CDPRemoteObject[]);

      return { output, variablesReference: outputVar };
    }
  }

  private async handleConsoleAPICall(message: any) {
    // We wrap console calls and add stack information as last three arguments, however
    // some logs may baypass that, especially when printed in initialization phase, so we
    // need to detect whether the wrapper has added the stack info or not
    // We check if there are more than 3 arguments, and if the last one is a number
    // We filter out logs that start with __RNIDE_INTERNAL as those are messages
    // used by IDE for tracking the app state and should not appear in the VSCode
    // console.
    const argsLen = message.params.args.length;
    let output: OutputEvent;

    if (argsLen > 0 && message.params.args[0].value === "__RNIDE_INTERNAL") {
      // We return here to avoid passing internal logs to the user debug console,
      // but they will still be visible in metro log feed.
      return;
    } else if (argsLen > 3 && message.params.args[argsLen - 1].type === "number") {
      // Since console.log stack is extracted from Error, unlike other messages sent over CDP
      // the line and column numbers are 1-based
      const [scriptURL, generatedLineNumber1Based, generatedColumn1Based] = message.params.args
        .slice(-3)
        .map((v: any) => v.value);

      const { lineNumber1Based, columnNumber0Based, sourceURL } =
        this.sourceMapRegistry.findOriginalPosition(
          scriptURL,
          generatedLineNumber1Based,
          generatedColumn1Based - 1
        );

      const formattedOutput = await this.formatDefaultString(message.params.args.slice(0, -3));

      output = new OutputEvent(formattedOutput.output, typeToCategory(message.params.type));

      output.body = {
        ...formattedOutput,
        //@ts-ignore source, line, column and group are valid fields
        source: new Source(sourceURL, sourceURL),
        line: this.linesStartAt1 ? lineNumber1Based : lineNumber1Based - 1,
        column: this.columnsStartAt1 ? columnNumber0Based + 1 : columnNumber0Based,
      };
    } else {
      const variablesRefDapID = this.createVariableForOutputEvent(message.params.args);

      const formattedOutput = await this.formatDefaultString(message.params.args);

      output = new OutputEvent(formattedOutput.output, typeToCategory(message.params.type));

      output.body = {
        ...formattedOutput,
        //@ts-ignore source, line, column and group are valid fields
        variablesReference: variablesRefDapID,
      };
    }
    this.sendEvent(output);
    this.sendEvent(
      new Event("RNIDE_consoleLog", { category: typeToCategory(message.params.type) })
    );
  }

  private async createVariableForOutputEvent(args: CDPRemoteObject[]) {
    const prepareVariables = (await Promise.all(
      args.map(async (arg: CDPRemoteObject, index: number) => {
         // Don't create variables for primitive types, we do it here
         // instead of .filter to keep indexes consistent
        if (arg.type !== "object" && arg.type !== "function") {
          return null;
        }

        arg.description = previewRemoteObject(arg, "propertyValue");

        if (arg.type === "object") {
          arg.objectId = this.variableStore.adaptCDPObjectId(arg.objectId).toString();
        }
        return { name: `arg${index}`, value: arg };
      })
    )).filter(value => value !== null);

    // we create empty object that is needed for DAP OutputEvent to display
    // collapsed args properly, the object references the array of args array
    const argsObjectDapID = this.variableStore.pushReplVariable(prepareVariables);

    // If originally there was only one argument, we don't want to display named arguments
    if (args.length === 1) {
      return argsObjectDapID;
    }

    return this.variableStore.pushReplVariable([
      {
        name: "<unnamed>",
        value: {
          type: "object",
          objectId: argsObjectDapID.toString(),
          className: "Object",
          description: "object",
        },
      },
    ]);
  }

  private async handleDebuggerPaused(message: any) {
    // We reset the paused* variables to lifecycle of objects references in DAP. https://microsoft.github.io/debug-adapter-protocol//overview.html#lifetime-of-objects-references
    this.pausedStackFrames = [];
    this.pausedScopeChains = [];

    if (
      message.params.reason === "other" &&
      message.params.callFrames[0].functionName === "__RNIDE_breakOnError"
    ) {
      // this is a workaround for an issue with hermes which does not provide a full stack trace
      // when it pauses due to the uncaught exception. Instead, we trigger debugger pause from exception
      // reporting handler, and access the actual error's stack trace from local variable
      const localScopeCDPObjectId = message.params.callFrames[0].scopeChain?.find(
        (scope: any) => scope.type === "local"
      )?.object?.objectId;
      const localScopeObjectId = this.variableStore.adaptCDPObjectId(localScopeCDPObjectId);
      const localScopeVariables = await this.variableStore.get(
        localScopeObjectId,
        (params: object) => {
          return this.cdpSession.sendCDPMessage("Runtime.getProperties", params);
        }
      );
      const errorMessage = localScopeVariables.find((v) => v.name === "message")?.value;
      const isFatal = localScopeVariables.find((v) => v.name === "isFatal")?.value;
      const stackObjectId = localScopeVariables.find((v) => v.name === "stack")?.variablesReference;

      const stackObjectProperties = await this.variableStore.get(
        stackObjectId!,
        (params: object) => {
          return this.cdpSession.sendCDPMessage("Runtime.getProperties", params);
        }
      );

      const stackFrames: Array<StackFrame> = [];
      // Unfortunately we can't get proper scope chanins here, because the debugger doesn't really stop at the frame where exception is thrown
      await Promise.all(
        stackObjectProperties.map(async (stackObjEntry) => {
          // we process entry with numerical names
          if (stackObjEntry.name.match(/^\d+$/)) {
            const index = parseInt(stackObjEntry.name, 10);
            const stackObjProperties = await this.variableStore.get(
              stackObjEntry.variablesReference,
              (params: object) => {
                return this.cdpSession.sendCDPMessage("Runtime.getProperties", params);
              }
            );
            const methodName = stackObjProperties.find((v) => v.name === "methodName")?.value || "";
            const genUrl = stackObjProperties.find((v) => v.name === "file")?.value || "";
            const genLine1Based = parseInt(
              stackObjProperties.find((v) => v.name === "lineNumber")?.value || "0"
            );
            const genColumn1Based = parseInt(
              stackObjProperties.find((v) => v.name === "column")?.value || "0"
            );
            const { sourceURL, lineNumber1Based, columnNumber0Based, scriptURL } =
              this.sourceMapRegistry.findOriginalPosition(
                genUrl,
                genLine1Based,
                genColumn1Based - 1
              );
            stackFrames[index] = new StackFrame(
              index,
              methodName,
              sourceURL ? new Source(scriptURL, sourceURL) : undefined,
              this.linesStartAt1 ? lineNumber1Based : lineNumber1Based - 1,
              this.columnsStartAt1 ? columnNumber0Based + 1 : columnNumber0Based
            );
          }
        })
      );
      this.pausedStackFrames = stackFrames;
      this.sendEvent(new StoppedEvent("exception", this.threads[0].id, errorMessage));
      this.sendEvent(new Event("RNIDE_paused", { reason: "exception", isFatal: isFatal }));
    } else {
      this.pausedStackFrames = message.params.callFrames.map((cdpFrame: any, index: number) => {
        const cdpLocation = cdpFrame.location;
        const { sourceURL, lineNumber1Based, columnNumber0Based, scriptURL } =
          this.sourceMapRegistry.findOriginalPosition(
            cdpLocation.scriptId,
            cdpLocation.lineNumber + 1, // cdp line and column numbers are 0-based
            cdpLocation.columnNumber
          );
        return new StackFrame(
          index,
          cdpFrame.functionName,
          sourceURL ? new Source(scriptURL, sourceURL) : undefined,
          this.linesStartAt1 ? lineNumber1Based : lineNumber1Based - 1,
          this.columnsStartAt1 ? columnNumber0Based + 1 : columnNumber0Based
        );
      });
      this.pausedScopeChains = message.params.callFrames.map(
        (cdpFrame: any) => cdpFrame.scopeChain
      );
      this.sendEvent(new StoppedEvent("breakpoint", this.threads[0].id, "Yollo"));
      this.sendEvent(new Event("RNIDE_paused"));
    }
  }

  protected initializeRequest(
    response: DebugProtocol.InitializeResponse,
    args: DebugProtocol.InitializeRequestArguments
  ): void {
    this.linesStartAt1 = args.linesStartAt1 || true;
    this.columnsStartAt1 = args.columnsStartAt1 || true;
    response.body = response.body || {};
    // response.body.supportsConditionalBreakpoints = true;
    // response.body.supportsHitConditionalBreakpoints = true;
    // response.body.supportsFunctionBreakpoints = true;
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
    const sourcePath = args.source.path;
    if (!sourcePath) {
      this.sendResponse(response);
      return;
    }

    const resolvedBreakpoints = await this.breakpointsController.setBreakpoints(
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
    response.body = response.body || {};

    response.body.scopes =
      this.pausedScopeChains[args.frameId]?.map((scope) => ({
        name: scope.type === "closure" ? "CLOSURE" : scope.name || scope.type.toUpperCase(), // for closure type, names are just numbers, so they don't look good, instead we just use name "CLOSURE"
        variablesReference: this.variableStore.adaptCDPObjectId(scope.object.objectId),
        presentationHint: inferDAPScopePresentationHintFromCDPType(scope.type),
        expensive: scope.type !== "local", // we only mark local scope as non-expensive as it is the one typically people want to look at and shouldn't have too many objects
      })) || [];
    this.sendResponse(response);
  }

  protected async variablesRequest(
    response: DebugProtocol.VariablesResponse,
    args: DebugProtocol.VariablesArguments
  ): Promise<void> {
    response.body = response.body || {};
    response.body.variables = [];

    if (args.filter === "indexed") {
      const stringified = "" + getArraySlots;

      try {
        const partialValue = await this.cdpSession.sendCDPMessage("Runtime.callFunctionOn", {
          functionDeclaration: stringified,
          objectId: this.variableStore.convertDAPObjectIdToCDP(args.variablesReference),
          arguments: [args.start, args.count].map((value) => ({ value })),
        });

        const properties = await this.variableStore.get(
          this.variableStore.adaptCDPObjectId(partialValue.result.objectId),
          (params: object) => {
            return this.cdpSession.sendCDPMessage("Runtime.getProperties", params);
          }
        );

        response.body.variables = properties;
      } catch (e) {
        Logger.error("[CDP] Failed to retrieve array partially", e);
      }
    }

    if (args.filter !== "indexed" && args.filter !== "named") {
      response.body.variables = await this.variableStore.get(
        args.variablesReference,
        (params: object) => {
          return this.cdpSession.sendCDPMessage("Runtime.getProperties", params);
        }
      );
    }

    this.sendResponse(response);
  }

  protected async continueRequest(
    response: DebugProtocol.ContinueResponse,
    args: DebugProtocol.ContinueArguments
  ): Promise<void> {
    await this.cdpSession.sendCDPMessage("Debugger.resume", { terminateOnResume: false });
    this.sendResponse(response);
    this.sendEvent(new Event("RNIDE_continued"));
  }

  protected async nextRequest(
    response: DebugProtocol.NextResponse,
    args: DebugProtocol.NextArguments
  ): Promise<void> {
    await this.cdpSession.sendCDPMessage("Debugger.stepOver", {});
    this.sendResponse(response);
  }

  protected disconnectRequest(
    response: DebugProtocol.DisconnectResponse,
    args: DebugProtocol.DisconnectArguments
  ): void {
    this.cdpSession.closeConnection();
    this.sendResponse(response);
  }

  protected async evaluateRequest(
    response: DebugProtocol.EvaluateResponse,
    args: DebugProtocol.EvaluateArguments
  ): Promise<void> {
    const cdpResponse = await this.cdpSession.sendCDPMessage("Runtime.evaluate", {
      expression: args.expression,
    });
    const remoteObject = cdpResponse.result;
    const stringValue = inferDAPVariableValueForCDPRemoteObject(remoteObject);

    response.body = response.body || {};
    response.body.result = stringValue;
    response.body.variablesReference = 0;
    if (remoteObject.type === "object") {
      const dapID = this.variableStore.adaptCDPObjectId(remoteObject.objectId);
      response.body.type = "object";
      response.body.variablesReference = dapID;
    }
    this.sendResponse(response);
  }

  protected customRequest(
    command: string,
    response: DebugProtocol.Response,
    args: any,
    request?: DebugProtocol.Request | undefined
  ): void {
    Logger.debug(`Custom req ${command} ${args}`);
  }
}
