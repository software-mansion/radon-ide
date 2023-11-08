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
  Breakpoint,
  Source,
  StackFrame,
} from "@vscode/debugadapter";
import { DebugProtocol } from "@vscode/debugprotocol";
import WebSocket from "ws";
import { NullablePosition, SourceMapConsumer } from "source-map";
import { formatMessage } from "./logFormatting";

function typeToCategory(type: string) {
  switch (type) {
    case "warning":
    case "error":
      return "stderr";
    default:
      return "stdout";
  }
}

class MyBreakpoint extends Breakpoint {
  public readonly line: number;
  public readonly column: number | undefined;
  private _id: number | undefined;
  constructor(verified: boolean, line: number, column?: number, source?: Source) {
    super(verified, line, column, source);
    this.column = column;
    this.line = line;
  }
  setId(id: number): void {
    super.setId(id);
    this._id = id;
  }
  getId(): number | undefined {
    // we cannot use `get id` here, because Breakpoint actually has a private field
    // called id, and it'd collide with this getter making it impossible to set it
    return this._id;
  }
}

export class DebugAdapter extends DebugSession {
  private connection: WebSocket;
  private configuration: DebugConfiguration;
  private threads: Array<Thread> = [];
  private sourceMaps: Array<[string, number, SourceMapConsumer]> = [];
  private stoppedStackFrames: StackFrame[] = [];

  public _yollo = "yollo";

  constructor(configuration: DebugConfiguration) {
    super();
    this.configuration = configuration;
    this.connection = new WebSocket(configuration.websocketAddress);

    this.connection.on("open", () => {
      this.sendCDPMessage("Runtime.enable", {});
      this.sendCDPMessage("Debugger.enable", { maxScriptsCacheSize: 100000000 });
      this.sendCDPMessage("Debugger.setPauseOnExceptions", { state: "none" });
      this.sendCDPMessage("Debugger.setAsyncCallStackDepth", { maxDepth: 32 });
      this.sendCDPMessage("Debugger.setBlackboxPatterns", { patterns: [] });
      this.sendCDPMessage("Runtime.runIfWaitingForDebugger", {});
    });

    this.connection.on("close", () => {
      this.sendEvent(new TerminatedEvent());
    });

    this.connection.on("message", async (data) => {
      const message = JSON.parse(data.toString());
      if (message.result) {
        const resolve = this.cdpMessagePromises.get(message.id);
        this.cdpMessagePromises.delete(message.id);
        if (resolve) {
          resolve(message.result);
        }
        return;
      }
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
          if (sourceMapURL.startsWith("data:")) {
            const base64Data = sourceMapURL.split(",")[1];
            const decodedData = Buffer.from(base64Data, "base64").toString("utf-8");
            const sourceMap = JSON.parse(decodedData);
            const consumer = await new SourceMapConsumer(sourceMap);
            this.sourceMaps.push([message.params.url, message.params.scriptId, consumer]);
            this.updateBreakpointsInSource(message.params.url, consumer);
          }
          this.sendEvent(new InitializedEvent());
          break;
        case "Debugger.paused":
          this.handleDebuggerPaused(message);
          break;
        case "Debugger.resumed":
          this.sendEvent(new ContinuedEvent(this.threads[0].id));
          break;
        case "Runtime.consoleAPICalled":
          this.handleConsoleAPICall(message);
          break;
        default:
          break;
      }
    });
  }

  private async handleConsoleAPICall(message: any) {
    const [scriptURL, generatedLineNumber, generatedColumn] = message.params.args
      .slice(-3)
      .map((v) => v.value);

    const output = await formatMessage(message.params.args.slice(0, -3), this);

    const outputEvent = new OutputEvent(output + "\n", typeToCategory(message.params.type));
    const { lineNumber, columnNumber, sourceURL } = this.findOriginalPositionFromScript(
      scriptURL,
      generatedLineNumber,
      generatedColumn
    );
    outputEvent.body.source = new Source(sourceURL, sourceURL);
    outputEvent.body.line = lineNumber - 1; // idk why it sometimes wants 0-based numbers and other times it doesn't
    outputEvent.body.column = columnNumber;
    this.sendEvent(outputEvent);
    this.sendEvent(new Event("rnp_consoleLog", { category: outputEvent.body.category }));
  }

  private findOriginalPosition(scriptId: number, lineNumber: number, columnNumber: number) {
    let sourceURL: string | null = null;
    let scriptURL = "";
    let sourceLine = lineNumber;
    let sourceColumn = columnNumber;
    this.sourceMaps.forEach(([url, id, consumer]) => {
      if (id === scriptId) {
        scriptURL = url;

        const pos = consumer.originalPositionFor({ line: lineNumber, column: columnNumber });
        if (pos.source != null) {
          sourceURL = pos.source;
        }
        if (pos.line != null) {
          sourceLine = pos.line + 1;
        }
        if (pos.column != null) {
          sourceColumn = pos.column + 1;
        }
      }
    });
    return { sourceURL, lineNumber: sourceLine, columnNumber: sourceColumn, scriptURL };
  }

  private findOriginalPositionFromScript(
    scriptURL: string,
    lineNumber: number,
    columnNumber: number
  ) {
    let sourceURL: string | null = null;
    let sourceLine = lineNumber;
    let sourceColumn = columnNumber;
    this.sourceMaps.forEach(([url, id, consumer]) => {
      if (url === scriptURL) {
        const pos = consumer.originalPositionFor({ line: lineNumber, column: columnNumber });
        if (pos.source != null) {
          sourceURL = pos.source;
        }
        if (pos.line != null) {
          sourceLine = pos.line + 1;
        }
        if (pos.column != null) {
          sourceColumn = pos.column + 1;
        }
      }
    });
    return { sourceURL, lineNumber: sourceLine, columnNumber: sourceColumn, scriptURL };
  }

  private async handleDebuggerPaused(message: any) {
    if (
      message.params.reason === "other" &&
      message.params.callFrames[0].functionName === "sztudioBreakOnError"
    ) {
      // this is a workaround for an issue with hermes which does not provide a full stack trace
      // when it pauses due to the uncaught exception. Instead, we trigger debugger pause from exception
      // reporting handler, and access the actual error's stack trace from local variable
      const localScropeObjectId = message.params.callFrames[0].scopeChain?.find(
        (scope) => scope.type === "local"
      )?.object?.objectId;
      const res = await this.sendCDPMessage("Runtime.getProperties", {
        objectId: localScropeObjectId,
        ownProperties: true,
      });
      const errorMessage = res.result.find((prop: any) => prop.name === "message")?.value?.value;
      const isFatal = res.result.find((prop: any) => prop.name === "isFatal")?.value?.value;
      const stackObject = res.result.find((prop: any) => prop.name === "stack");
      const stackResponse = await this.sendCDPMessage("Runtime.getProperties", {
        objectId: stackObject.value.objectId,
        ownProperties: true,
      });
      const stackFrames = [];
      await Promise.all(
        stackResponse.result.map(async (stackObjEntry: any) => {
          // we process entry with numerical names
          if (stackObjEntry.name.match(/^\d+$/)) {
            const index = parseInt(stackObjEntry.name, 10);
            const res = await this.sendCDPMessage("Runtime.getProperties", {
              objectId: stackObjEntry.value.objectId,
              ownProperties: true,
            });
            let genUrl = "",
              methodName = "",
              genLine = 0,
              genColumn = 0;
            res.result.forEach((prop: any) => {
              switch (prop.name) {
                case "methodName":
                  methodName = prop.value.value;
                  break;
                case "file":
                  genUrl = prop.value.value;
                  break;
                case "lineNumber":
                  genLine = prop.value.value;
                  break;
                case "column":
                  genColumn = prop.value.value;
                  break;
              }
            });
            const { sourceURL, lineNumber, columnNumber, scriptURL } =
              this.findOriginalPositionFromScript(genUrl, genLine, genColumn);
            stackFrames[index] = new StackFrame(
              index,
              methodName,
              sourceURL ? new Source(scriptURL, sourceURL) : undefined,
              lineNumber,
              columnNumber
            );
          }
        })
      );
      this.stoppedStackFrames = stackFrames;
      this.sendEvent(new StoppedEvent("exception", this.threads[0].id, errorMessage));
      this.sendEvent(new Event("rnp_paused", { reason: "exception", isFatal: isFatal }));
    } else {
      this.stoppedStackFrames = message.params.callFrames.map((cdpFrame: any, index: number) => {
        const cdpLocation = cdpFrame.location;
        const { sourceURL, lineNumber, columnNumber, scriptURL } = this.findOriginalPosition(
          cdpLocation.scriptId,
          cdpLocation.lineNumber,
          cdpLocation.columnNumber
        );
        return new StackFrame(
          index,
          cdpFrame.functionName,
          sourceURL ? new Source(scriptURL, sourceURL) : undefined,
          lineNumber,
          columnNumber
        );
      });
      this.sendEvent(new StoppedEvent("breakpoint", this.threads[0].id, "Yollo"));
      this.sendEvent(new Event("rnp_paused"));
    }
  }

  private cdpMessageId = 0;
  private cdpMessagePromises: Map<number, (result: any) => void> = new Map();

  public async sendCDPMessage(method: string, params: object) {
    const message = {
      id: ++this.cdpMessageId,
      method: method,
      params: params,
    };
    this.connection.send(JSON.stringify(message));
    return new Promise<any>((resolve) => {
      this.cdpMessagePromises.set(message.id, resolve);
    });
  }

  protected initializeRequest(
    response: DebugProtocol.InitializeResponse,
    args: DebugProtocol.InitializeRequestArguments
  ): void {
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

  private toGeneratedPosition(file: string, line: number, column: number) {
    let position: NullablePosition = { line: null, column: null, lastColumn: null };
    let originalSourceURL: string = "";
    this.sourceMaps.forEach(([sourceURL, scriptId, consumer]) => {
      const sources = [];
      consumer.eachMapping((mapping) => {
        sources.push(mapping.source);
      });
      const pos = consumer.generatedPositionFor({
        source: file,
        line,
        column,
        bias: SourceMapConsumer.LEAST_UPPER_BOUND,
      });
      if (pos.line != null) {
        originalSourceURL = sourceURL;
        position = pos;
      }
    });
    if (position.line === null) {
      return null;
    }
    return { source: originalSourceURL, line: position.line, column: position.column };
  }

  private async setCDPBreakpoint(file: string, line: number, column: number) {
    const generatedPos = this.toGeneratedPosition(file, line, column);
    if (generatedPos) {
      const result = await this.sendCDPMessage("Debugger.setBreakpointByUrl", {
        lineNumber: generatedPos.line - 1,
        url: generatedPos.source,
        columnNumber: generatedPos.column,
        condition: "",
      });
      if (result && result.breakpointId !== undefined) {
        return result.breakpointId as number;
      }
    }
    return null;
  }

  private breakpoints = new Map<string, Array<MyBreakpoint>>();

  private updateBreakpointsInSource(sourceURL: string, consumer: SourceMapConsumer) {
    // this method gets called after we are informed that a new script has been parsed. If we
    // had breakpoints set in that script, we need to let the runtime know about it

    const pathsToUpdate = new Set<string>();
    consumer.eachMapping((mapping) => {
      if (this.breakpoints.has(mapping.source)) {
        pathsToUpdate.add(mapping.source);
      }
    });

    pathsToUpdate.forEach((path) => {
      const breakpoints = this.breakpoints.get(path) || [];
      breakpoints.forEach(async (bp) => {
        if (bp.verified) {
          this.sendCDPMessage("Debugger.removeBreakpoint", { breakpointId: bp.getId() });
        }
        const newId = await this.setCDPBreakpoint(path, bp.line, bp.column || 0);
        if (newId !== null) {
          bp.setId(newId);
          bp.verified = true;
        } else {
          bp.verified = false;
        }
      });
    });
  }

  protected async setBreakPointsRequest(
    response: DebugProtocol.SetBreakpointsResponse,
    args: DebugProtocol.SetBreakpointsArguments
  ): Promise<void> {
    const path = args.source.path as string;

    const previousBreakpoints = this.breakpoints.get(path) || [];

    const breakpoints = (args.breakpoints || []).map((bp) => {
      const previousBp = previousBreakpoints.find(
        (prevBp) => prevBp.line === bp.line && prevBp.column === bp.column
      );
      if (previousBp) {
        return previousBp;
      } else {
        return new MyBreakpoint(false, bp.line, bp.column);
      }
    });

    // remove old breakpoints
    previousBreakpoints.forEach((bp) => {
      if (
        bp.verified &&
        !breakpoints.find((newBp) => newBp.line === bp.line && newBp.column === bp.column)
      ) {
        this.sendCDPMessage("Debugger.removeBreakpoint", { breakpointId: bp.getId() });
      }
    });

    this.breakpoints.set(path, breakpoints);

    const resolvedBreakpoints = await Promise.all<Breakpoint>(
      breakpoints.map(async (bp) => {
        if (bp.verified) {
          return bp;
        } else {
          const breakpointId = await this.setCDPBreakpoint(path, bp.line, bp.column || 0);
          if (breakpointId !== null) {
            bp.verified = true;
            bp.setId(breakpointId);
            return bp;
          } else {
            return bp;
          }
        }
      })
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
    response.body.stackFrames = this.stoppedStackFrames;
    this.sendResponse(response);
  }

  protected scopesRequest(
    response: DebugProtocol.ScopesResponse,
    args: DebugProtocol.ScopesArguments
  ): void {
    // Implement getting the scopes
    this.sendResponse(response);
  }

  protected variablesRequest(
    response: DebugProtocol.VariablesResponse,
    args: DebugProtocol.VariablesArguments
  ): void {
    // Implement getting the variables
    this.sendResponse(response);
  }

  protected async continueRequest(
    response: DebugProtocol.ContinueResponse,
    args: DebugProtocol.ContinueArguments
  ): Promise<void> {
    // Implement continuing execution
    await this.sendCDPMessage("Debugger.resume", { terminateOnResume: false });
    this.sendResponse(response);
    this.sendEvent(new Event("rnp_continued"));
  }

  protected disconnectRequest(
    response: DebugProtocol.DisconnectResponse,
    args: DebugProtocol.DisconnectArguments
  ): void {
    // Implement disconnecting from the debugger
    this.connection.close();
    this.sendResponse(response);
  }

  protected customRequest(
    command: string,
    response: DebugProtocol.Response,
    args: any,
    request?: DebugProtocol.Request | undefined
  ): void {
    console.log("Custom req", command, args);
  }
}
