import assert from "assert";
import { commands, debug, DebugConsoleMode, DebugSessionCustomEvent, Disposable } from "vscode";
import * as vscode from "vscode";
import { Cdp } from "vscode-cdp-proxy";
import { disposeAll } from "../utilities/disposables";
import { startDebugging } from "./startDebugging";
import { extensionContext } from "../utilities/extensionContext";
import { Logger } from "../Logger";
import { CancelToken } from "../utilities/cancelToken";

const MASTER_DEBUGGER_TYPE = "com.swmansion.react-native-debugger";
const OLD_JS_DEBUGGER_TYPE = "com.swmansion.js-debugger";
const PROXY_JS_DEBUGGER_TYPE = "com.swmansion.proxy-debugger";

export const DEBUG_CONSOLE_LOG = "RNIDE_consoleLog";
export const DEBUG_PAUSED = "RNIDE_paused";
export const DEBUG_RESUMED = "RNIDE_continued";

export interface JSDebugConfiguration {
  websocketAddress: string;
  sourceMapPathOverrides: Record<string, string>;
  displayDebuggerOverlay: boolean;
  installConnectRuntime?: boolean;
  isUsingNewDebugger: boolean;
  expoPreludeLineCount: number;
}

export type DebugSource = { filename?: string; line1based?: number; column0based?: number };

export type DebugSessionOptions = {
  displayName: string;
  useParentDebugSession?: boolean;
  suppressDebugToolbar?: boolean;
};

type DebugSessionCustomEventListener = (event: DebugSessionCustomEvent) => void;

export interface DebugSession {
  // debug console conreols -- perhaps this should be moved to a separate interface?
  appendDebugConsoleEntry(message: string, type: string, source?: DebugSource): Promise<void>;

  // lifecycle methods
  startParentDebugSession(): Promise<void>;
  startJSDebugSession(configuration: JSDebugConfiguration): Promise<void>;
  restart(): Promise<void>;

  // debugger controls
  resumeDebugger(): void;
  stepOverDebugger(): void;
  stepOutDebugger(): void;
  stepIntoDebugger(): void;
  evaluateExpression(params: Cdp.Runtime.EvaluateParams): Promise<Cdp.Runtime.EvaluateResult>;

  // Profiling controls
  startProfilingCPU(): Promise<void>;
  stopProfilingCPU(): Promise<void>;

  // events
  onConsoleLog(listener: DebugSessionCustomEventListener): Disposable;
  onDebuggerPaused(listener: DebugSessionCustomEventListener): Disposable;
  onDebuggerResumed(listener: DebugSessionCustomEventListener): Disposable;
  onProfilingCPUStarted(listener: DebugSessionCustomEventListener): Disposable;
  onProfilingCPUStopped(listener: DebugSessionCustomEventListener): Disposable;
  onBindingCalled(listener: DebugSessionCustomEventListener): Disposable;
  onDebugSessionTerminated(listener: () => void): Disposable;
}

export class DebugSessionImpl implements DebugSession, Disposable {
  private parentDebugSession: vscode.DebugSession | undefined;
  private jsDebugSession: vscode.DebugSession | undefined;
  private cancelStartDebuggingToken: CancelToken = new CancelToken();

  private disposables: Disposable[] = [];

  private consoleLogEventEmitter = new vscode.EventEmitter<DebugSessionCustomEvent>();
  private debuggerPausedEventEmitter = new vscode.EventEmitter<DebugSessionCustomEvent>();
  private debuggerResumedEventEmitter = new vscode.EventEmitter<DebugSessionCustomEvent>();
  private profilingCPUStartedEventEmitter = new vscode.EventEmitter<DebugSessionCustomEvent>();
  private profilingCPUStoppedEventEmitter = new vscode.EventEmitter<DebugSessionCustomEvent>();
  private bindingCalledEventEmitter = new vscode.EventEmitter<DebugSessionCustomEvent>();
  private debugSessionTerminatedEventEmitter = new vscode.EventEmitter<void>();

  public onConsoleLog = this.consoleLogEventEmitter.event;
  public onDebuggerPaused = this.debuggerPausedEventEmitter.event;
  public onDebuggerResumed = this.debuggerResumedEventEmitter.event;
  public onProfilingCPUStarted = this.profilingCPUStartedEventEmitter.event;
  public onProfilingCPUStopped = this.profilingCPUStoppedEventEmitter.event;
  public onBindingCalled = this.bindingCalledEventEmitter.event;
  public onDebugSessionTerminated = this.debugSessionTerminatedEventEmitter.event;

  constructor(private options: DebugSessionOptions = { displayName: "Radon IDE Debugger" }) {
    this.disposables.push(
      debug.onDidTerminateDebugSession((session) => {
        if (session.id === this.jsDebugSession?.id) {
          this.debugSessionTerminatedEventEmitter.fire();
        }
      })
    );
    this.disposables.push(
      debug.onDidReceiveDebugSessionCustomEvent((event) => {
        switch (event.event) {
          case DEBUG_CONSOLE_LOG:
            this.consoleLogEventEmitter.fire(event);
            break;
          case DEBUG_PAUSED:
            this.debuggerPausedEventEmitter.fire(event);
            break;
          case DEBUG_RESUMED:
            this.debuggerResumedEventEmitter.fire(event);
            break;
          case "RNIDE_profilingCPUStarted":
            this.profilingCPUStartedEventEmitter.fire(event);
            break;
          case "RNIDE_profilingCPUStopped":
            this.profilingCPUStoppedEventEmitter.fire(event);
            break;
          case "RNIDE_bindingCalled":
            this.bindingCalledEventEmitter.fire(event);
            break;
          default:
            // ignore other events
            break;
        }
      })
    );
    this.disposables.push(
      this.consoleLogEventEmitter,
      this.debuggerPausedEventEmitter,
      this.debuggerResumedEventEmitter,
      this.profilingCPUStartedEventEmitter,
      this.profilingCPUStoppedEventEmitter,
      this.bindingCalledEventEmitter,
      this.debugSessionTerminatedEventEmitter
    );
  }

  public async startParentDebugSession() {
    assert(
      !this.jsDebugSession,
      "Cannot start parent debug session when js debug session is already running"
    );

    this.cancelStartingDebugSession();

    this.parentDebugSession = await startDebugging(
      undefined,
      {
        type: MASTER_DEBUGGER_TYPE,
        name: this.options.displayName,
        request: "attach",
      },
      {
        suppressDebugStatusbar: true,
        suppressDebugView: true,
        suppressDebugToolbar: true,
        suppressSaveBeforeStart: true,
      },
      this.cancelStartDebuggingToken
    );
  }

  public async restart() {
    this.cancelStartingDebugSession();
    await this.stopJsDebugSession();
    if (this.options.useParentDebugSession && !this.parentDebugSession) {
      await this.startParentDebugSession();
    }
  }

  private async stopJsDebugSession() {
    if (this.jsDebugSession) {
      const jsDebugSession = this.jsDebugSession;
      this.jsDebugSession = undefined;
      await debug.stopDebugging(jsDebugSession);
    }
  }

  private async stop() {
    this.cancelStartingDebugSession();
    await this.stopJsDebugSession();
    if (this.parentDebugSession) {
      const parentDebugSession = this.parentDebugSession;
      this.parentDebugSession = undefined;
      await debug.stopDebugging(parentDebugSession);
    }
  }

  public async dispose() {
    return this.stop()
      .catch()
      .then(() => disposeAll(this.disposables));
  }

  public async startJSDebugSession(configuration: JSDebugConfiguration) {
    if (this.jsDebugSession) {
      await this.restart();
    }

    if (this.options.useParentDebugSession && !this.parentDebugSession) {
      await this.startParentDebugSession();
    }

    const isUsingNewDebugger = configuration.isUsingNewDebugger;
    const debuggerType = isUsingNewDebugger ? PROXY_JS_DEBUGGER_TYPE : OLD_JS_DEBUGGER_TYPE;

    const extensionPath = extensionContext.extensionUri.path;

    this.cancelStartingDebugSession();

    const newDebugSession = await startDebugging(
      undefined,
      {
        type: debuggerType,
        name: this.options.displayName,
        request: "attach",
        breakpointsAreRemovedOnContextCleared: isUsingNewDebugger ? false : true, // new debugger properly keeps all breakpoints in between JS reloads
        sourceMapPathOverrides: configuration.sourceMapPathOverrides,
        websocketAddress: configuration.websocketAddress,
        expoPreludeLineCount: configuration.expoPreludeLineCount,
        displayDebuggerOverlay: configuration.displayDebuggerOverlay,
        skipFiles: [
          "__source__",
          `${extensionPath}/**/*`,
          "**/node_modules/**/*",
          "!**/node_modules/expo-router/**/*",
        ],
      },
      {
        parentSession: this.parentDebugSession,
        suppressDebugStatusbar: true,
        suppressDebugView: true,
        suppressDebugToolbar: this.options.suppressDebugToolbar ?? true,
        suppressSaveBeforeStart: true,
        consoleMode: DebugConsoleMode.MergeWithParent,
        compact: true,
      },
      this.cancelStartDebuggingToken
    );
    if (this.jsDebugSession) {
      Logger.warn("JS debugger session has spawned concurrently, dropping the earlier session");
      debug.stopDebugging(this.jsDebugSession);
    }
    this.jsDebugSession = newDebugSession;
  }

  public resumeDebugger() {
    commands.executeCommand("workbench.action.debug.continue", undefined, {
      sessionId: this.jsDebugSession?.id,
    });
  }

  public stepOverDebugger() {
    commands.executeCommand("workbench.action.debug.stepOver", undefined, {
      sessionId: this.jsDebugSession?.id,
    });
  }
  public stepOutDebugger() {
    commands.executeCommand("workbench.action.debug.stepOut", undefined, {
      sessionId: this.jsDebugSession?.id,
    });
  }
  public stepIntoDebugger() {
    commands.executeCommand("workbench.action.debug.stepInto", undefined, {
      sessionId: this.jsDebugSession?.id,
    });
  }

  public async startProfilingCPU() {
    await this.jsDebugSession?.customRequest("RNIDE_startProfiling");
  }

  public async stopProfilingCPU() {
    await this.jsDebugSession?.customRequest("RNIDE_stopProfiling");
  }

  public async appendDebugConsoleEntry(message: string, type: string, source?: DebugSource) {
    await this.parentDebugSession?.customRequest("RNIDE_log_message", { message, type, source });
  }

  public async evaluateExpression(
    params: Cdp.Runtime.EvaluateParams
  ): Promise<Cdp.Runtime.EvaluateResult> {
    if (!this.jsDebugSession) {
      throw new Error("JS Debug session is not running");
    }
    const response = await this.jsDebugSession.customRequest("RNIDE_evaluate", params);
    return response;
  }

  private cancelStartingDebugSession() {
    this.cancelStartDebuggingToken.cancel();
    this.cancelStartDebuggingToken = new CancelToken();
  }
}
