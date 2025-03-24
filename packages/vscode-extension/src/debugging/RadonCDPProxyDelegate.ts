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

  private justCalledStepOver = false;
  private resumeEventTimeout: NodeJS.Timeout | undefined;

  public onDebuggerPaused = this.debuggerPausedEmitter.event;
  public onDebuggerResumed = this.debuggerResumedEmitter.event;
  public onConsoleAPICalled = this.consoleAPICalledEmitter.event;

  constructor(private sourceMapRegistry: SourceMapsRegistry) {}

  public async handleApplicationCommand(
    applicationCommand: IProtocolCommand,
    tunnel: ProxyTunnel
  ): Promise<IProtocolCommand | IProtocolSuccess | IProtocolError | undefined> {
    switch (applicationCommand.method) {
      case "Runtime.consoleAPICalled": {
        return this.handleConsoleAPICalled(applicationCommand);
      }
      case "Debugger.paused": {
        return this.handleDebuggerPaused(applicationCommand, tunnel);
      }
      case "Debugger.resumed": {
        return this.handleDebuggerResumed(applicationCommand, tunnel);
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
    if ((params.reason as string) === "other") {
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

  private handleDebuggerResumed(command: IProtocolCommand, tunnel: ProxyTunnel) {
    if (this.resumeEventTimeout) {
      // we clear resume event here as well as we will either schedule a new one
      // or fire the event immediately.
      clearTimeout(this.resumeEventTimeout);
      this.resumeEventTimeout = undefined;
    }
    if (this.justCalledStepOver) {
      // when step-over is called, we expect Debugger.resumed event to be called
      // after which the paused event will be fired almost immediately as the
      // debugger stops at the next line of code.
      // In order to prevent the paused event from being fired immediately resulting
      // in the overlay blinking for a fraction of second, we wait for a short period
      // just in case the paused event is never fired.
      this.justCalledStepOver = false;
      this.resumeEventTimeout = setTimeout(() => {
        this.debuggerResumedEmitter.fire({});
      }, 100);
    } else {
      this.debuggerResumedEmitter.fire({});
    }
    return command;
  }

  private handleDebuggerPaused(command: IProtocolCommand, tunnel: ProxyTunnel) {
    const params = command.params as Cdp.Debugger.PausedEvent;
    if (this.shouldResumeImmediately(params)) {
      tunnel.injectDebuggerCommand({
        method: "Debugger.resume",
        params: {},
      });
      if (command.id === undefined) {
        return undefined;
      }
      return { id: command.id, result: {} };
    }

    if (this.resumeEventTimeout) {
      // if resume event was delayed, we clear it
      clearTimeout(this.resumeEventTimeout);
      this.resumeEventTimeout = undefined;
    }

    this.debuggerPausedEmitter.fire({ reason: "breakpoint" });
    return command;
  }
  private setBreakpointCommands = new Map<number, Cdp.Debugger.SetBreakpointByUrlParams>();

  public async handleDebuggerCommand(
    command: IProtocolCommand,
    tunnel: ProxyTunnel
  ): Promise<IProtocolCommand> {
    switch (command.method) {
      case "Debugger.stepOver": {
        // setting this will cause the "resume" event from being slightly delayed as we
        // expect the "paused" event to be fired almost immediately.
        this.justCalledStepOver = true;
        return command;
      }
      case "Debugger.resume": {
        // we reset this flag to ensure that the "resume" event is not fired immediately
        this.justCalledStepOver = false;
        return command;
      }
      case "Runtime.enable": {
        await this.onRuntimeEnable(tunnel);
        return command;
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
      case "Debugger.setBreakpointByUrl": {
        this.setBreakpointCommands.set(
          command.id!,
          command.params as Cdp.Debugger.SetBreakpointByUrlParams
        );
        return command;
      }
    }
    return command;
  }

  // NOTE: sometimes on Fast Refresh, when we try to set a new breakpoint with the new location,
  // the breakpoint is not set correctly by the application.
  // To mitigate this, we retry setting the breakpoint one time.
  async maybeRetrySetBreakpointByUrl(reply: IProtocolSuccess, tunnel: ProxyTunnel) {
    const params = this.setBreakpointCommands.get(reply.id)!;
    this.setBreakpointCommands.delete(reply.id);
    const setBreakpointResult = reply.result as Cdp.Debugger.SetBreakpointByUrlResult;
    // NOTE: this condition was found by trial and error, it seems that if the breakpoint is not set
    // correctly, the locations array will be empty
    if (!setBreakpointResult.locations.length) {
      await tunnel
        .injectDebuggerCommand({
          method: "Debugger.removeBreakpoint",
          params: { breakpointId: setBreakpointResult.breakpointId },
        })
        .catch(_.noop);
      return tunnel
        .injectDebuggerCommand({
          method: "Debugger.setBreakpointByUrl",
          params,
        })
        .then((result): IProtocolSuccess => ({ id: reply.id, result }))
        .catch((error): IProtocolError => ({ id: reply.id, error }));
    }
    return reply;
  }

  public async handleApplicationReply(
    reply: IProtocolSuccess | IProtocolError,
    tunnel: ProxyTunnel
  ): Promise<IProtocolSuccess | IProtocolError | undefined> {
    if (reply.id && "result" in reply && this.setBreakpointCommands.has(reply.id)) {
      const finalReply = await this.maybeRetrySetBreakpointByUrl(reply, tunnel);
      return finalReply;
    }
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

  private handleConsoleAPICalled(
    command: IProtocolCommand
  ): IProtocolCommand | IProtocolSuccess | undefined {
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
      return command.id !== undefined ? { id: command.id, result: {} } : undefined;
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
