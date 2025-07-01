import { IProtocolCommand, IProtocolSuccess, IProtocolError, Cdp } from "vscode-cdp-proxy";
import { EventEmitter } from "vscode";
import { Minimatch } from "minimatch";
import _ from "lodash";
import path from "path";
import fs from "fs/promises";
import { CDPProxyDelegate, ProxyTunnel } from "./CDPProxy";
import { SourceMapsRegistry } from "./SourceMapsRegistry";
import { Logger } from "../Logger";
import { extensionContext } from "../utilities/extensionContext";
import { getTelemetryReporter } from "../utilities/telemetry";

export class RadonCDPProxyDelegate implements CDPProxyDelegate {
  private debuggerPausedEmitter = new EventEmitter<{ reason: "breakpoint" | "exception" }>();
  private debuggerResumedEmitter = new EventEmitter();
  private consoleAPICalledEmitter = new EventEmitter();
  private bindingCalledEmitter = new EventEmitter<{ name: string; payload: any }>();
  private ignoredPatterns: Minimatch[] = [];

  private justCalledStepOver = false;
  private resumeEventTimeout: NodeJS.Timeout | undefined;

  public onDebuggerPaused = this.debuggerPausedEmitter.event;
  public onDebuggerResumed = this.debuggerResumedEmitter.event;
  public onConsoleAPICalled = this.consoleAPICalledEmitter.event;
  public onBindingCalled = this.bindingCalledEmitter.event;

  constructor(
    private sourceMapRegistry: SourceMapsRegistry,
    skipFiles: string[],
    private installConnectRuntime: boolean
  ) {
    this.ignoredPatterns = skipFiles.map(
      (pattern) => new Minimatch(pattern, { flipNegate: true, dot: true })
    );
  }

  public async handleApplicationCommand(
    applicationCommand: IProtocolCommand,
    tunnel: ProxyTunnel
  ): Promise<IProtocolCommand | IProtocolSuccess | IProtocolError | undefined> {
    switch (applicationCommand.method) {
      case "Runtime.consoleAPICalled": {
        return this.handleConsoleAPICalled(applicationCommand);
      }
      case "Runtime.bindingCalled": {
        return this.handleBindingCalled(applicationCommand);
      }
      case "Debugger.paused": {
        return this.handleDebuggerPaused(applicationCommand, tunnel);
      }
      case "Debugger.resumed": {
        return this.handleDebuggerResumed(applicationCommand, tunnel);
      }
      case "Debugger.scriptParsed": {
        return this.handleScriptParsed(applicationCommand, tunnel);
      }
      case "Runtime.executionContextsCleared": {
        this.sourceMapRegistry.clearSourceMaps();
        return applicationCommand;
      }
    }
    return applicationCommand;
  }

  private shouldSkipFile(sourceURL: string): boolean {
    return this.ignoredPatterns.reduce((shouldSkip, p) => {
      if (p.negate) {
        // don't skip the file if some negated pattern matches it
        return shouldSkip && !p.match(sourceURL);
      } else {
        return shouldSkip || p.match(sourceURL);
      }
    }, false);
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
    return this.shouldSkipFile(sourceURL);
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
    const { method } = command;
    switch (method) {
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
      case "Debugger.setBlackboxPatterns": {
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

  private async getSourceMapData(sourceMapURL: string) {
    if (sourceMapURL.startsWith("data:")) {
      const base64Data = sourceMapURL.split(",")[1];
      const decodedData = Buffer.from(base64Data, "base64").toString("utf-8");
      const sourceMapData = JSON.parse(decodedData);
      return sourceMapData;
    }

    if (sourceMapURL.startsWith("http")) {
      const result = await fetch(sourceMapURL);
      const data = await result.json();
      return data;
    }

    throw new Error("Source map URL schemas other than `data` and `http` are not supported");
  }

  private async setupRadonConnectRuntime(tunnel: ProxyTunnel) {
    // load script from lib/connect_runtime.js and evaluate it
    const runtimeScriptPath = path.join(
      extensionContext.extensionPath,
      "dist",
      "connect_runtime.js"
    );
    const runtimeScript = await fs.readFile(runtimeScriptPath, "utf8");

    await tunnel.injectDebuggerCommand({
      method: "Runtime.addBinding",
      params: {
        name: "__radon_binding",
      },
    });

    const result = (await tunnel.injectDebuggerCommand({
      method: "Runtime.evaluate",
      params: {
        expression: runtimeScript,
      },
    })) as Cdp.Runtime.EvaluateResult;
    if (result.exceptionDetails) {
      Logger.error("Failed to setup Radon Connect runtime", result.exceptionDetails);
      getTelemetryReporter().sendTelemetryEvent("radon-connect:setup-runtime-error", {
        error: result.exceptionDetails.exception?.description ?? "Unknown error",
      });
    }
  }

  private handleBindingCalled(command: IProtocolCommand) {
    const params = command.params as Cdp.Runtime.BindingCalledEvent;
    this.bindingCalledEmitter.fire(params);
    return command;
  }

  private async handleScriptParsed(
    command: IProtocolCommand,
    tunnel: ProxyTunnel
  ): Promise<IProtocolCommand> {
    const { sourceMapURL, url, scriptId } = command.params as Cdp.Debugger.ScriptParsedEvent;
    if (!sourceMapURL) {
      return command;
    }

    try {
      const sourceMapData = await this.getSourceMapData(sourceMapURL);
      const isMainBundle = sourceMapData.sources.some((source: string) =>
        source.includes("__prelude__")
      );

      this.sourceMapRegistry.registerSourceMap(sourceMapData, url, scriptId, isMainBundle);

      if (isMainBundle && this.installConnectRuntime) {
        await this.setupRadonConnectRuntime(tunnel);
      }
    } catch (e) {
      Logger.error("Could not process the source map", e);
    }
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

    if (stackTrace) {
      const filteredCallFrames = stackTrace?.callFrames.filter((frame) => {
        const { scriptId, lineNumber, columnNumber } = frame;
        const { sourceURL } = this.sourceMapRegistry.findOriginalPosition(
          scriptId,
          lineNumber + 1,
          columnNumber ?? 0
        );
        return !this.shouldSkipFile(sourceURL);
      });
      if (filteredCallFrames.length > 0) {
        // we only filter frames if there's at least one frame left, otherwise we would still
        // want some location information to be available so we keep the original one.
        stackTrace.callFrames = filteredCallFrames;
      }
    }

    this.consoleAPICalledEmitter.fire({});

    return command;
  }
}
