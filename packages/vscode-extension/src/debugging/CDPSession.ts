import WebSocket from "ws";
import { OutputEvent, Source, StackFrame } from "@vscode/debugadapter";
import { DebugProtocol } from "@vscode/debugprotocol";
import { Cdp } from "vscode-js-debug/out/cdp/index";
import { AnyObject } from "vscode-js-debug/out/adapter/objectPreview/betterTypes";
import { formatMessage } from "vscode-js-debug/out/adapter/messageFormat";
import {
  messageFormatters,
  previewAsObject,
  previewRemoteObject,
} from "vscode-js-debug/out/adapter/objectPreview";
import { Logger } from "../Logger";
import { SourceMapsRegistry } from "./SourceMapsRegistry";
import { BreakpointsController } from "./BreakpointsController";
import { VariableStore } from "./variableStore";
import { CDPDebuggerScope, CDPRemoteObject } from "./cdp";
import { typeToCategory } from "./DebugAdapter";
import { annotateLocations } from "./cpuProfiler";

type ResolveType<T = unknown> = (result: T) => void;
type RejectType = (error: unknown) => void;

type PromiseHandlers<T = unknown> = {
  resolve: ResolveType<T>;
  reject: RejectType;
};

export interface CDPSessionDelegate {
  onExecutionContextCreated(threadId: number, threadName: string): void;
  onConnectionClosed: () => void;
  onDebugSessionReady: () => void;
  onDebuggerPaused: (message: any) => void;
  onDebuggerResumed: () => void;
  onExecutionContextsCleared: () => void;
  sendOutputEvent: (output: OutputEvent) => void;
  sendStoppedEvent: (
    pausedStackFrames: StackFrame[],
    pausedScopeChains: CDPDebuggerScope[][],
    reason: string
  ) => void;
}

const RETRIEVE_VARIABLE_TIMEOUT_MS = 3000;

export class CDPSession {
  private connection: WebSocket;

  private variableStore: VariableStore = new VariableStore();
  private linesStartAt1 = true;
  private columnsStartAt1 = true;

  private cdpMessageId = 0;
  private cdpMessagePromises: Map<number, PromiseHandlers> = new Map();

  private sourceMapRegistry: SourceMapsRegistry;

  private breakpointsController: BreakpointsController;

  constructor(
    private delegate: CDPSessionDelegate,
    websocketAddress: string,
    sourceMapConfiguration: { expoPreludeLineCount: number; sourceMapAliases: [string, string][] },
    breakpointsConfiguration: { breakpointsAreRemovedOnContextCleared: boolean }
  ) {
    this.sourceMapRegistry = new SourceMapsRegistry(
      sourceMapConfiguration.expoPreludeLineCount,
      sourceMapConfiguration.sourceMapAliases
    );

    this.breakpointsController = new BreakpointsController(
      this.sourceMapRegistry,
      this,
      breakpointsConfiguration.breakpointsAreRemovedOnContextCleared
    );

    this.connection = new WebSocket(websocketAddress);

    this.connection.on("open", this.setUpDebugger);

    this.connection.on("close", this.delegate.onConnectionClosed);

    this.connection.on("message", async (data) => {
      const message = JSON.parse(data.toString());
      if (message.result || message.error) {
        this.handleCDPMessageResponse(message);
        return;
      }
      await this.handleIncomingCDPMethodCalls(message);
    });
  }

  //#region CPD incoming communication

  private handleIncomingCDPMethodCalls = async (message: any) => {
    switch (message.method) {
      case "Runtime.executionContextCreated":
        const context = message.params.context;
        this.delegate.onExecutionContextCreated(context.id, context.name);
        break;
      case "Debugger.scriptParsed":
        const sourceMapURL = message.params.sourceMapURL;

        if (!sourceMapURL) {
          break;
        }

        let sourceMapData;

        if (sourceMapURL?.startsWith("data:")) {
          const base64Data = sourceMapURL.split(",")[1];
          const decodedData = Buffer.from(base64Data, "base64").toString("utf-8");
          sourceMapData = JSON.parse(decodedData);
        } else {
          try {
            const sourceMapResponse = await fetch(sourceMapURL);
            sourceMapData = await sourceMapResponse.json();
          } catch {
            Logger.debug(`Failed to fetch source map from: ${sourceMapURL}`);
          }
        }

        if (!sourceMapData || !sourceMapData.sources) {
          break;
        }

        // We detect when a source map for the entire bundle is loaded by checking if __prelude__ module is present in the sources.
        const isMainBundle = sourceMapData.sources.some((source: string) =>
          source.includes("__prelude__")
        );

        const consumer = await this.sourceMapRegistry!.registerSourceMap(
          sourceMapData,
          message.params.url,
          message.params.scriptId,
          isMainBundle
        );

        if (isMainBundle) {
          this.delegate.onDebugSessionReady();
        }

        this.breakpointsController.updateBreakpointsInSource(message.params.url, consumer);
        break;
      case "Debugger.paused":
        this.handleDebuggerPaused(message);
        break;
      case "Debugger.resumed":
        this.delegate.onDebuggerResumed();
        break;
      case "Runtime.executionContextsCleared":
        // clear all existing source maps, breakpoints and variable store
        this.sourceMapRegistry.clearSourceMaps();
        this.breakpointsController.onContextCleared();
        this.variableStore.clearReplVariables();
        this.variableStore.clearCDPVariables();

        // inform debug adapter that context was Cleared
        this.delegate.onExecutionContextsCleared();
        break;
      case "Runtime.consoleAPICalled":
        this.handleConsoleAPICall(message);
        break;
      default:
        break;
    }
  };

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
        this.sourceMapRegistry!.findOriginalPosition(
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
      const variablesRefDapID = await this.createVariableForOutputEvent(message.params.args);

      const formattedOutput = await this.formatDefaultString(message.params.args);

      output = new OutputEvent(formattedOutput.output, typeToCategory(message.params.type));

      output.body = {
        ...formattedOutput,
        //@ts-ignore source, line, column and group are valid fields
        variablesReference: variablesRefDapID,
      };
    }
    this.delegate.sendOutputEvent(output);
  }

  private async handleDebuggerPaused(message: any) {
    const stackFrames = message.params.callFrames.map((cdpFrame: any, index: number) => {
      const cdpLocation = cdpFrame.location;
      const { sourceURL, lineNumber1Based, columnNumber0Based } =
        this.sourceMapRegistry!.findOriginalPosition(
          cdpLocation.scriptId,
          cdpLocation.lineNumber + 1, // cdp line and column numbers are 0-based
          cdpLocation.columnNumber
        );
      return new StackFrame(
        index,
        cdpFrame.functionName,
        sourceURL ? new Source(sourceURL, sourceURL) : undefined,
        this.linesStartAt1 ? lineNumber1Based : lineNumber1Based - 1,
        this.columnsStartAt1 ? columnNumber0Based + 1 : columnNumber0Based
      );
    });
    const scopeChains = message.params.callFrames.map((cdpFrame: any) => cdpFrame.scopeChain);

    this.delegate.sendStoppedEvent(stackFrames, scopeChains, "breakpoint");
  }

  private handleCDPMessageResponse(message: any) {
    const messagePromise = this.cdpMessagePromises.get(message.id);
    this.cdpMessagePromises.delete(message.id);
    if (message.result && messagePromise?.resolve) {
      messagePromise.resolve(message.result);
    } else if (message.error && messagePromise?.reject) {
      Logger.warn("CDP message error received", message.error);
      // create an error object such that we can capture stack trace and assign
      // all object error properties as provided by CDP
      const error = new Error();
      Object.assign(error, message.error);
      messagePromise.reject(error);
    }
  }

  //#endregion

  //#region CPD outgoing communication

  public handleSetBreakpointRequest(
    sourcePath: string,
    breakpoints: DebugProtocol.SourceBreakpoint[] | undefined
  ) {
    return this.breakpointsController.setBreakpoints(sourcePath, breakpoints);
  }

  private setUpDebugger = async () => {
    // the below catch handler is used to ignore errors coming from non critical CDP messages we
    // expect in some setups to fail
    const ignoreError = () => {};
    await this.sendCDPMessage("FuseboxClient.setClientMetadata", {}).catch(ignoreError);
    await this.sendCDPMessage("ReactNativeApplication.enable", {}).catch(ignoreError);
    await this.sendCDPMessage("Runtime.enable", {});
    await this.sendCDPMessage("Debugger.enable", { maxScriptsCacheSize: 100000000 });
    await this.sendCDPMessage("Debugger.setPauseOnExceptions", { state: "none" });
    await this.sendCDPMessage("Debugger.setAsyncCallStackDepth", { maxDepth: 32 }).catch(
      ignoreError
    );
    await this.sendCDPMessage("Debugger.setBlackboxPatterns", { patterns: [] }).catch(ignoreError);
    await this.sendCDPMessage("Runtime.runIfWaitingForDebugger", {}).catch(ignoreError);
  };

  public closeConnection() {
    this.connection.close();
  }

  public async sendCDPMessage(method: string, params: object, timeoutMs?: number) {
    const message = {
      id: ++this.cdpMessageId,
      method: method,
      params: params,
    };
    this.connection.send(JSON.stringify(message));
    return new Promise<any>((resolve, reject) => {
      let timeout: NodeJS.Timeout;
      if (timeoutMs) {
        timeout = setTimeout(() => {
          this.cdpMessagePromises.delete(message.id);
          reject(new Error("Cdp did not respond before timeout"));
        }, timeoutMs);
      }

      this.cdpMessagePromises.set(message.id, {
        resolve: (e: any) => {
          timeout && clearTimeout(timeout);
          resolve(e);
        },
        reject,
      });
    });
  }

  //#endregion

  //#region variable store

  public adaptCDPObjectId(id: string) {
    return this.variableStore.adaptCDPObjectId(id);
  }

  public convertDAPObjectIdToCDP(variablesReference: number) {
    return this.variableStore.convertDAPObjectIdToCDP(variablesReference);
  }

  public getVariable(variablesReference: number) {
    return this.variableStore.get(variablesReference, (params: object) => {
      return this.sendCDPMessage("Runtime.getProperties", params, RETRIEVE_VARIABLE_TIMEOUT_MS);
    });
  }

  private async createVariableForOutputEvent(args: CDPRemoteObject[]) {
    const prepareVariables = (
      await Promise.all(
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
      )
    ).filter((value) => value !== null);

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

  // Based on https://github.com/microsoft/vscode-js-debug/blob/3be255753c458f231e32c9ef5c60090236780060/src/adapter/console/textualMessage.ts#L83
  // We use that to format and truncate console.log messages
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

  //#endregion

  //#region source map registry

  public findOriginalPosition(filename: string, line0Based: number, column0Based: number) {
    return this.sourceMapRegistry.findOriginalPosition(filename, line0Based, column0Based);
  }

  //#endregion

  public async startProfiling() {
    await this.sendCDPMessage("Profiler.start", {});
  }

  public async stopProfiling() {
    const result = await this.sendCDPMessage("Profiler.stop", {});
    const annotatedProfile = annotateLocations(result.profile, this.sourceMapRegistry);
    return annotatedProfile;
  }
}
