import assert from "assert";
import { commands, debug, DebugConsoleMode, DebugSessionCustomEvent, Disposable } from "vscode";
import * as vscode from "vscode";
import { disposeAll } from "../utilities/disposables";
import { sleep } from "../utilities/retry";
import { startDebugging } from "./startDebugging";
import { extensionContext } from "../utilities/extensionContext";
import { Logger } from "../Logger";
import { CancelToken } from "../utilities/cancelToken";
import { RadonInspectorBridge } from "../project/bridge";

const PING_TIMEOUT = 1000;

const MASTER_DEBUGGER_TYPE = "com.swmansion.react-native-debugger";
const OLD_JS_DEBUGGER_TYPE = "com.swmansion.js-debugger";
const PROXY_JS_DEBUGGER_TYPE = "com.swmansion.proxy-debugger";

export const DEBUG_CONSOLE_LOG = "RNIDE_consoleLog";
export const DEBUG_PAUSED = "RNIDE_paused";
export const DEBUG_RESUMED = "RNIDE_continued";

export type DebugSessionDelegate = {
  onConsoleLog?(event: DebugSessionCustomEvent): void;
  onDebuggerPaused?(event: DebugSessionCustomEvent): void;
  onDebuggerResumed?(event: DebugSessionCustomEvent): void;
  onProfilingCPUStarted?(event: DebugSessionCustomEvent): void;
  onProfilingCPUStopped?(event: DebugSessionCustomEvent): void;
  onBindingCalled?(event: DebugSessionCustomEvent): void;
  onDebugSessionTerminated?(): void;
};

export interface JSDebugConfiguration {
  websocketAddress: string;
  sourceMapPathOverrides: Record<string, string>;
  displayDebuggerOverlay: boolean;
  isUsingNewDebugger: boolean;
  expoPreludeLineCount: number;
}

export type DebugSource = { filename?: string; line1based?: number; column0based?: number };

type DebugSessionOptions = {
  displayName: string;
  useParentDebugSession?: boolean;
};

export class DebugSession implements Disposable {
  private parentDebugSession: vscode.DebugSession | undefined;
  private jsDebugSession: vscode.DebugSession | undefined;
  private cancelStartDebuggingToken: CancelToken = new CancelToken();

  private disposables: Disposable[] = [];

  private currentWsTarget: string | undefined;

  constructor(
    private delegate: DebugSessionDelegate,
    private options: DebugSessionOptions = { displayName: "Radon IDE Debugger" }
  ) {
    this.disposables.push(
      debug.onDidTerminateDebugSession((session) => {
        if (session.id === this.jsDebugSession?.id) {
          this.delegate.onDebugSessionTerminated?.();
        }
      })
    );
    this.disposables.push(
      debug.onDidReceiveDebugSessionCustomEvent((event) => {
        switch (event.event) {
          case DEBUG_CONSOLE_LOG:
            this.delegate.onConsoleLog?.(event);
            break;
          case DEBUG_PAUSED:
            this.delegate.onDebuggerPaused?.(event);
            break;
          case DEBUG_RESUMED:
            this.delegate.onDebuggerResumed?.(event);
            break;
          case "RNIDE_profilingCPUStarted":
            this.delegate.onProfilingCPUStarted?.(event);
            break;
          case "RNIDE_profilingCPUStopped":
            this.delegate.onProfilingCPUStopped?.(event);
            break;
          case "RNIDE_bindingCalled":
            this.delegate.onBindingCalled?.(event);
            break;
          default:
            // ignore other events
            break;
        }
      })
    );
  }

  public get websocketTarget() {
    return this.currentWsTarget;
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
    this.currentWsTarget = undefined;
  }

  public async stop() {
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
        suppressDebugToolbar: true,
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
    this.currentWsTarget = configuration.websocketAddress;

    return true;
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

  public async pingJsDebugSessionWithTimeout() {
    if (!this.jsDebugSession) {
      return false;
    }
    const resultPromise = this.jsDebugSession.customRequest("RNIDE_ping").then((response) => {
      return !!response.result;
    });
    const timeout = sleep(PING_TIMEOUT).then(() => {
      throw new Error("Ping timeout");
    });
    return Promise.race([resultPromise, timeout]).catch((_e) => false);
  }

  public postMessage(data: any) {
    this.jsDebugSession?.customRequest("RNIDE_postMessage", data);
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

  private cancelStartingDebugSession() {
    this.cancelStartDebuggingToken.cancel();
    this.cancelStartDebuggingToken = new CancelToken();
  }
}
