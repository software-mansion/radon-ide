import assert from "assert";
import path from "path";
import { commands, debug, DebugConsoleMode, DebugSessionCustomEvent, Disposable } from "vscode";
import * as vscode from "vscode";
import { Metro } from "../project/metro";
import { disposeAll } from "../utilities/disposables";
import { sleep } from "../utilities/retry";

const PING_TIMEOUT = 1000;

const MASTER_DEBUGGER_TYPE = "com.swmansion.react-native-debugger";
const OLD_JS_DEBUGGER_TYPE = "com.swmansion.js-debugger";
const PROXY_JS_DEBUGGER_TYPE = "com.swmansion.proxy-debugger";

export const DEBUG_CONSOLE_LOG = "RNIDE_consoleLog";
export const DEBUG_PAUSED = "RNIDE_paused";
export const DEBUG_RESUMED = "RNIDE_continued";

export type DebugSessionDelegate = {
  onConsoleLog(event: DebugSessionCustomEvent): void;
  onDebuggerPaused(event: DebugSessionCustomEvent): void;
  onDebuggerResumed(event: DebugSessionCustomEvent): void;
  onProfilingCPUStarted(event: DebugSessionCustomEvent): void;
  onProfilingCPUStopped(event: DebugSessionCustomEvent): void;
  onDebugSessionTerminated(): void;
};

export interface JSDebugConfiguration {
  websocketAddress: string;
  watchFolders: string[];
  displayDebuggerOverlay: boolean;
  isUsingNewDebugger: boolean;
  expoPreludeLineCount: number;
}

export type DebugSource = { filename?: string; line1based?: number; column0based?: number };

/**
 * Helpr function that starts a debug session and returns the session object upon sucesfull start
 */
async function startDebugging(
  folder: vscode.WorkspaceFolder | undefined,
  nameOrConfiguration: string | vscode.DebugConfiguration,
  parentSessionOrOptions?: vscode.DebugSession | vscode.DebugSessionOptions
) {
  const debugSessionType =
    typeof nameOrConfiguration === "string" ? nameOrConfiguration : nameOrConfiguration.type;
  let debugSession: vscode.DebugSession | undefined;
  let didStartHandler: Disposable | null = debug.onDidStartDebugSession((session) => {
    if (session.type === debugSessionType) {
      didStartHandler?.dispose();
      didStartHandler = null;
      debugSession = session;
    }
  });
  try {
    const debugStarted = await debug.startDebugging(
      folder,
      nameOrConfiguration,
      parentSessionOrOptions
    );

    if (debugStarted) {
      // NOTE: this is safe, because `debugStarted` means the session started successfully,
      // and we set the session in the `onDidStartDebugSession` handler
      assert(debugSession, "Expected debug session to be set");
      return debugSession;
    } else {
      throw new Error("Failed to start debug session");
    }
  } finally {
    didStartHandler?.dispose();
  }
}

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
            this.delegate.onConsoleLog(event);
            break;
          case DEBUG_PAUSED:
            this.delegate.onDebuggerPaused(event);
            break;
          case DEBUG_RESUMED:
            this.delegate.onDebuggerResumed(event);
            break;
          case "RNIDE_profilingCPUStarted":
            this.delegate.onProfilingCPUStarted(event);
            break;
          case "RNIDE_profilingCPUStopped":
            this.delegate.onProfilingCPUStopped(event);
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
    const debuggerType = isUsingNewDebugger ? PROXY_JS_DEBUGGER_TYPE : OLD_JS_DEBUGGER_TYPE;

    const sourceMapPathOverrides: Record<string, string> = {};
    const metroWatchFolders = configuration.watchFolders;
    if (isUsingNewDebugger && metroWatchFolders.length > 0) {
      sourceMapPathOverrides["/[metro-project]/*"] = `${metroWatchFolders[0]}${path.sep}*`;
      metroWatchFolders.forEach((watchFolder, index) => {
        sourceMapPathOverrides[`/[metro-watchFolders]/${index}/*`] = `${watchFolder}${path.sep}*`;
      });
    }

    this.jsDebugSession = await startDebugging(
      undefined,
      {
        type: debuggerType,
        name: "React Native JS Debugger",
        request: "attach",
        breakpointsAreRemovedOnContextCleared: isUsingNewDebugger ? false : true, // new debugger properly keeps all breakpoints in between JS reloads
        sourceMapPathOverrides,
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
