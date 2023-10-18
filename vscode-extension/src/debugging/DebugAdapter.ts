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

function typeToTag(type) {
  switch (type) {
    case "info":
      return "[INFO]";
    case "warn":
      return "[WARN]";
    case "error":
      return "[ERR] ";
    default:
      return "[LOG] ";
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
          this.sendEvent(
            new OutputEvent(`${message.params.type}: ${message.params.args.join(" ")}`, "console")
          );
          break;
        default:
          break;
      }
    });
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
    this.sendEvent(new StoppedEvent("breakpoint", this.threads[0].id));
    this.sendEvent(new Event("rnp_paused"));
  }

  private cdpMessageId = 0;
  private cdpMessagePromises: Map<number, (result: any) => void> = new Map();

  private async sendCDPMessage(method: string, params: object) {
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

  private async setCDPBreakpoint(source: string, line: number, column: number) {
    let position: NullablePosition = { line: null, column: null, lastColumn: null };
    let originalSourceURL: string = "";
    this.sourceMaps.forEach(([sourceURL, scriptId, consumer]) => {
      const sources = [];
      consumer.eachMapping((mapping) => {
        sources.push(mapping.source);
      });
      const pos = consumer.generatedPositionFor({
        source,
        line,
        column,
        bias: SourceMapConsumer.LEAST_UPPER_BOUND,
      });
      if (pos.line != null) {
        originalSourceURL = sourceURL;
        position = pos;
      }
    });
    if (position.line != null) {
      const result = await this.sendCDPMessage("Debugger.setBreakpointByUrl", {
        lineNumber: position.line - 1,
        url: originalSourceURL,
        columnNumber: position.column,
        condition: "",
      });
      if (result && result.breakpointId !== undefined) {
        return result.breakpointId as number;
      }
    }
    return null;
  }

  protected async setBreakPointsRequest(
    response: DebugProtocol.SetBreakpointsResponse,
    args: DebugProtocol.SetBreakpointsArguments
  ): Promise<void> {
    const path = args.source.path as string;

    const actualBreakpoints = (args.breakpoints || []).map(async (bp) => {
      const breakpointId = await this.setCDPBreakpoint(path, bp.line, bp.column || 0);
      if (breakpointId !== null) {
        const actualBreakpoint = new Breakpoint(true, bp.line, bp.column);
        actualBreakpoint.setId(breakpointId);
        return actualBreakpoint;
      } else {
        return new Breakpoint(false, bp.line, bp.column);
      }
    });

    const resolvedBreakpoints = await Promise.all<DebugProtocol.Breakpoint>(actualBreakpoints);

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
    if (command === "rnp_consoleLog") {
      const outputEvent = new OutputEvent(
        typeToTag(args.type) + " " + (args.args || []).join(" ") + "\n",
        "console"
      );
      if (args.stack && args.stack.length > 0) {
        const { file, lineNumber: bundleLineNumber, column } = args.stack[0];
        const { lineNumber, columnNumber, sourceURL } = this.findOriginalPositionFromScript(
          file,
          bundleLineNumber,
          column
        );
        outputEvent.body.source = new Source(sourceURL, sourceURL);
        outputEvent.body.line = lineNumber - 1; // idk why it sometimes wants 0-based numbers and other times it doesn't
        outputEvent.body.column = columnNumber;
      }
      this.sendEvent(outputEvent);
    }
  }
}
