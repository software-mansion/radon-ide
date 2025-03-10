import { IProtocolCommand, IProtocolSuccess, IProtocolError, Cdp } from "vscode-cdp-proxy";
import { EventEmitter } from "vscode";
import _ from "lodash";
import { CDPProxyDelegate, ProxyTunnel } from "./CDPProxy";
import { SourceMapsRegistry } from "./SourceMapsRegistry";
import { Logger } from "../Logger";

export class RadonCDPProxyDelegate implements CDPProxyDelegate {
  private debuggerPausedEmitter = new EventEmitter();
  private debuggerResumedEmitter = new EventEmitter();

  public onDebuggerPaused = this.debuggerPausedEmitter.event;
  public onDebuggerResumed = this.debuggerResumedEmitter.event;

  constructor(private sourceMapRegistry: SourceMapsRegistry) {}

  public async handleApplicationCommand(
    command: IProtocolCommand
  ): Promise<IProtocolCommand | undefined> {
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
      case "Runtime.executionContextsCleared": {
        this.sourceMapRegistry.clearSourceMaps();
        return command;
      }
    }
    return command;
  }

  public async handleDebuggerCommand(
    command: IProtocolCommand,
    tunnel: ProxyTunnel
  ): Promise<IProtocolCommand | undefined> {
    switch (command.method) {
      case "Debugger.resume": {
        this.debuggerResumedEmitter.fire({});
        return command;
      }
      case "Runtime.enable": {
        await this.onRuntimeEnable(tunnel);
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

  private async onRuntimeEnable(tunnel: ProxyTunnel) {
    await tunnel
      .injectDebuggerCommand({
        method: "FuseboxClient.setClientMetadata",
        params: {},
      })
      .catch(_.noop);
    await tunnel
      .injectDebuggerCommand({
        method: "ReactNativeApplication.enable",
        params: {},
      })
      .catch(_.noop);
  }

  private handleScriptParsed(command: IProtocolCommand): IProtocolCommand {
    const { sourceMapURL, url, scriptId } = command.params as Cdp.Debugger.ScriptParsedEvent;
    if (!sourceMapURL) {
      return command;
    }

    if (!sourceMapURL.startsWith("data:")) {
      Logger.error(
        "Source map URL doesn't encode source map data, mapping sources may not work correctly",
        sourceMapURL
      );
      return command;
    }

    const base64Data = sourceMapURL.split(",")[1];
    const decodedData = Buffer.from(base64Data, "base64").toString("utf-8");
    const sourceMapData = JSON.parse(decodedData);

    const isMainBundle = sourceMapData.sources.some((source: string) =>
      source.includes("__prelude__")
    );

    this.sourceMapRegistry.registerSourceMap(sourceMapData, url, scriptId, isMainBundle);
    return command;
  }

  private handleConsoleAPICalled(command: IProtocolCommand): IProtocolCommand | undefined {
    const { args, stackTrace } = command.params as Cdp.Runtime.ConsoleAPICalledEvent;

    // We wrap console calls and add stack information as last three arguments, however
    // some logs may baypass that, especially when printed in initialization phase, so we
    // need to detect whether the wrapper has added the stack info or not
    // We check if there are more than 3 arguments, and if the last one is a number
    // We filter out logs that start with __RNIDE_INTERNAL as those are messages
    // used by IDE for tracking the app state and should not appear in the VSCode
    // console.
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
}
