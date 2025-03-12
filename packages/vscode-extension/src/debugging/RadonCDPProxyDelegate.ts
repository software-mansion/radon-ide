import { IProtocolCommand, IProtocolSuccess, IProtocolError, Cdp } from "vscode-cdp-proxy";
import { EventEmitter } from "vscode";
import _ from "lodash";
import { CDPProxyDelegate, ProxyTunnel } from "./CDPProxy";
import { SourceMapsRegistry } from "./SourceMapsRegistry";
import { Logger } from "../Logger";

export class RadonCDPProxyDelegate implements CDPProxyDelegate {
  private debuggerPausedEmitter = new EventEmitter<{ reason: "breakpoint" | "exception" }>();
  private debuggerResumedEmitter = new EventEmitter();
  private consoleAPICalledEmitter = new EventEmitter();
  private blackBoxPatterns: RegExp[] = [];

  public onDebuggerPaused = this.debuggerPausedEmitter.event;
  public onDebuggerResumed = this.debuggerResumedEmitter.event;
  public onConsoleAPICalled = this.consoleAPICalledEmitter.event;

  constructor(private sourceMapRegistry: SourceMapsRegistry) {}

  public async handleApplicationCommand(
    command: IProtocolCommand,
    tunnel: ProxyTunnel
  ): Promise<IProtocolCommand | IProtocolSuccess | IProtocolError> {
    switch (command.method) {
      case "Runtime.consoleAPICalled": {
        return this.handleConsoleAPICalled(applicationCommand);
      }
      case "Debugger.paused": {
        return this.handleDebuggerPaused(command, tunnel);
      }
      case "Debugger.scriptParsed": {
        return this.handleScriptParsed(applicationCommand);
      }
      case "Runtime.executionContextsCleared": {
        this.sourceMapRegistry.clearSourceMaps();
        return applicationCommand;
      }
    }
    return applicationCommand;
  }

  private shouldResumeImmediately(params: Cdp.Debugger.PausedEvent): boolean {
    if (params.reason !== "exception") {
      return false;
    }
    const { scriptId, lineNumber, columnNumber } = params.callFrames[0].location;
    const { sourceURL } = this.sourceMapRegistry.findOriginalPosition(
      scriptId,
      lineNumber + 1,
      columnNumber ?? 0
    );
    const shouldSkipFile = this.blackBoxPatterns.some((p) => p.exec(sourceURL)?.length);
    return shouldSkipFile;
  }

  private handleDebuggerPaused(command: IProtocolCommand, tunnel: ProxyTunnel) {
    const params = command.params as Cdp.Debugger.PausedEvent;
    if (this.shouldResumeImmediately(params)) {
      tunnel.injectDebuggerCommand({
        method: "Debugger.resume",
        params: {},
      });
      return { id: command.id!, result: {} };
    }
    this.debuggerPausedEmitter.fire({ reason: "breakpoint" });
    return command;
  }

  public async handleDebuggerCommand(
    debuggerCommand: IProtocolCommand,
    tunnel: ProxyTunnel
  ): Promise<IProtocolCommand> {
    switch (command.method) {
      case "Debugger.resume": {
        this.debuggerResumedEmitter.fire({});
        return debuggerCommand;
      }
      case "Runtime.enable": {
        await this.onRuntimeEnable(tunnel);
        return debuggerCommand;
      }
      // NOTE: setBlackbox* commands (as of 0.78) are not handled correctly by the Hermes debugger, so we need to disable them.
      // Instead, we handle exception pauses in the blackboxed files explicitely in the `handleDebuggerPaused` method.
      case "Debugger.setBlackboxPatterns": {
        const params = command.params as Cdp.Debugger.SetBlackboxPatternsParams;
        this.blackBoxPatterns = params.patterns.map((p) => new RegExp(p));
        command.params = {
          patterns: [],
        };
        return command;
      }
      case "Debugger.setBlackboxedRanges": {
        if ("positions" in command.params) {
          command.params.positions = [];
        }
        return command;
      }
    }
    return debuggerCommand;
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

  private handleConsoleAPICalled(command: IProtocolCommand): IProtocolCommand | IProtocolSuccess {
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
      return { id: command.id!, result: {} };
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
    }

    this.consoleAPICalledEmitter.fire({});

    return command;
  }
}
