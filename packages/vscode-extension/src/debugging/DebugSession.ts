import assert from "assert";
import { commands, debug, DebugConsoleMode, DebugSessionCustomEvent, Disposable } from "vscode";
import * as vscode from "vscode";
import { disposeAll } from "../utilities/disposables";
import { sleep } from "../utilities/retry";
import { startDebugging } from "./startDebugging";

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

export class DebugSession implements Disposable {
  private parentDebugSession: vscode.DebugSession | undefined;
  private jsDebugSession: vscode.DebugSession | undefined;

  private useParentDebugSession = false;
  private disposables: Disposable[] = [];

  private currentWsTarget: string | undefined;

  constructor(private delegate: DebugSessionDelegate) {
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
    this.useParentDebugSession = true;
    this.parentDebugSession = await startDebugging(
      undefined,
      {
        type: MASTER_DEBUGGER_TYPE,
        name: "Radon IDE Debugger",
        request: "attach",
      },
      {
        suppressDebugStatusbar: true,
        suppressDebugView: true,
        suppressDebugToolbar: true,
        suppressSaveBeforeStart: true,
      }
    );
  }

  public async restart() {
    await this.stop();
    if (this.useParentDebugSession) {
      await this.startParentDebugSession();
    }
  }

  private async stop() {
    if (this.parentDebugSession) {
      const parentDebugSession = this.parentDebugSession;
      this.parentDebugSession = undefined;
      await debug.stopDebugging(parentDebugSession);
    }
    if (this.jsDebugSession) {
      const jsDebugSession = this.jsDebugSession;
      this.jsDebugSession = undefined;
      await debug.stopDebugging(jsDebugSession);
    }
    this.currentWsTarget = undefined;
  }

  public dispose() {
    this.stop()
      .catch()
      .then(() => disposeAll(this.disposables));
  }

  public async startJSDebugSession(configuration: JSDebugConfiguration) {
    if (this.jsDebugSession) {
      await this.restart();
    }

    const isUsingNewDebugger = configuration.isUsingNewDebugger;
    const debuggerType = OLD_JS_DEBUGGER_TYPE;

    this.jsDebugSession = await startDebugging(
      undefined,
      {
        type: debuggerType,
        name: "React Native JS Debugger",
        request: "attach",
        breakpointsAreRemovedOnContextCleared: isUsingNewDebugger ? false : true, // new debugger properly keeps all breakpoints in between JS reloads
        sourceMapPathOverrides: configuration.sourceMapPathOverrides,
        websocketAddress: configuration.websocketAddress,
        expoPreludeLineCount: configuration.expoPreludeLineCount,
        displayDebuggerOverlay: configuration.displayDebuggerOverlay,
      },
      {
        parentSession: this.parentDebugSession,
        suppressDebugStatusbar: true,
        suppressDebugView: true,
        suppressDebugToolbar: true,
        suppressSaveBeforeStart: true,
        consoleMode: DebugConsoleMode.MergeWithParent,
        compact: true,
      }
    );

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
      return !!response.body.result;
    });
    const timeout = sleep(PING_TIMEOUT).then(() => false);
    return Promise.any([resultPromise, timeout]);
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
}
