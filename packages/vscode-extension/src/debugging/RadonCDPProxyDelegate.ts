import { IProtocolCommand, IProtocolSuccess, IProtocolError, Cdp } from "vscode-cdp-proxy";
import { EventEmitter } from "vscode";
import { CDPProxyDelegate } from "./CDPProxy";
import { Logger } from "../Logger";
import _ from "lodash";

export class RadonCDPProxyDelegate implements CDPProxyDelegate {
  private debuggerPausedEmitter = new EventEmitter();
  private debuggerResumedEmitter = new EventEmitter();
  private debuggerReadyEmitter = new EventEmitter();

  public onDebuggerPaused = this.debuggerPausedEmitter.event;
  public onDebuggerResumed = this.debuggerResumedEmitter.event;
  public onDebuggerReady = this.debuggerReadyEmitter.event;

  constructor() {}

  public async handleApplicationCommand(
    command: IProtocolCommand
  ): Promise<IProtocolCommand | undefined> {
    console.log("Application Command", command);
    switch (command.method) {
      case "Runtime.consoleAPICalled": {
        return this.handleConsoleAPICalled(command);
      }
      case "Debugger.paused": {
        this.debuggerPausedEmitter.fire({});
        return command;
      }
      case "Debugger.scriptParsed": {
        return this.handleScriptParsed(command);
      }
    }
    return command;
  }

  public async handleDebuggerCommand(
    command: IProtocolCommand
  ): Promise<IProtocolCommand | undefined> {
    switch (command.method) {
      case "Debugger.resume": {
        this.debuggerResumedEmitter.fire({});
        return command;
      }
    }
    return command;
  }

  public async handleApplicationReply(
    reply: IProtocolSuccess | IProtocolError
  ): Promise<IProtocolSuccess | IProtocolError | undefined> {
    return reply;
  }

  public async handleDebuggerReply(
    reply: IProtocolSuccess | IProtocolError
  ): Promise<IProtocolSuccess | IProtocolError | undefined> {
    return reply;
  }

  private handleConsoleAPICalled(command: IProtocolCommand): IProtocolCommand | undefined {
    // We wrap console calls and add stack information as last three arguments, however
    // some logs may baypass that, especially when printed in initialization phase, so we
    // need to detect whether the wrapper has added the stack info or not
    // We check if there are more than 3 arguments, and if the last one is a number
    // We filter out logs that start with __RNIDE_INTERNAL as those are messages
    // used by IDE for tracking the app state and should not appear in the VSCode
    // console.
    const { args, stackTrace } = command.params as Cdp.Runtime.ConsoleAPICalledEvent;
    if (args.length > 0 && args[0].value === "__RNIDE_INTERNAL") {
      // We return here to avoid passing internal logs to the user debug console,
      // but they will still be visible in metro log feed.
      return undefined;
    }
    if (args.length > 3 && args[args.length - 1].type === "number") {
      // Since console.log stack is extracted from Error, unlike other messages sent over CDP
      // the line and column numbers are 1-based
      const [scriptURL, generatedLineNumber1Based, generatedColumn1Based] = args
        .splice(-3)
        .map((v) => v.value);

      // we find the frame received from the wrapped in the stack and remove all frames above it
      const originalCallFrameIndex = stackTrace?.callFrames.findIndex((frame) => {
        return (
          frame.url === scriptURL &&
          frame.lineNumber === generatedLineNumber1Based - 1 &&
          frame.columnNumber === generatedColumn1Based
        );
      });

      stackTrace?.callFrames.splice(0, originalCallFrameIndex);

      return command;
    }

    return command;
  }

  private async handleScriptParsed(
    _command: IProtocolCommand
  ): Promise<IProtocolCommand | undefined> {
    const command = _.cloneDeep(_command);
    const params = command.params as Cdp.Debugger.ScriptParsedEvent;
    const sourceMapURL = params.sourceMapURL;
    if (!sourceMapURL) {
      return command;
    }

    Logger.log("Source Map URL", sourceMapURL);

    let sourceMapData;
    if (sourceMapURL?.startsWith("data:")) {
      const base64Data = sourceMapURL.split(",")[1];
      const decodedData = Buffer.from(base64Data, "base64").toString("utf-8");
      sourceMapData = JSON.parse(decodedData);
    } else {
      try {
        const sourceMapResponse = await fetch(sourceMapURL);
        sourceMapData = await sourceMapResponse.json();
        const base64URL = Buffer.from(JSON.stringify(sourceMapData)).toString("base64");

        // we need to overwrite the sourceMapURL with the base64 encoded source map
        // because the js-debug node debugger does not support fetching source maps from http servers
        params.sourceMapURL = `data:application/json;base64,${base64URL}`;
      } catch {
        Logger.debug(`Failed to fetch source map from: ${sourceMapURL}`);
      }
    }

    if (!sourceMapData) {
      return command;
    }

    const isMainBundle = sourceMapData.sources.some((source: string) =>
      source.includes("__prelude__")
    );

    if (isMainBundle) {
      this.debuggerReadyEmitter.fire({});
    }

    return command;
  }
}
