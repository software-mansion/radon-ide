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

export interface DebugExtraConfiguration {
  websocketAddress?: string;
  displayDebuggerOverlay?: boolean;
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

  public async reconnectJSDebuggerIfNeeded(metro: Metro) {
    const isAlive = await this.isJsDebugSessionAlive(metro);
    if (!isAlive) {
      return this.startJSDebugSession(metro);
    }
    return true;
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

  public async startJSDebugSession(metro: Metro, extraConfiguration?: DebugExtraConfiguration) {
    if (this.jsDebugSession) {
      await this.restart();
    }

    let websocketAddress = extraConfiguration?.websocketAddress || (await metro.getDebuggerURL());
    if (!websocketAddress) {
      return false;
    }

    const isUsingNewDebugger = metro.isUsingNewDebugger;
    const debuggerType = isUsingNewDebugger ? PROXY_JS_DEBUGGER_TYPE : OLD_JS_DEBUGGER_TYPE;

    const sourceMapPathOverrides: Record<string, string> = {};
    const metroWatchFolders = metro.watchFolders;
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
        websocketAddress,
        expoPreludeLineCount: metro.expoPreludeLineCount,
        displayDebuggerOverlay: extraConfiguration?.displayDebuggerOverlay,
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

    this.currentWsTarget = websocketAddress;

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

  public async isJsDebugSessionAlive(metro: Metro): Promise<boolean> {
    /**
     * We use a combination of two check to determine if the js debug session is alive and active:
     * 1. we use "ping" command that executes a simple JS code using Runtime.evaluate to determine that the runtime responds.
     * 2. we check if the runtime is listed on the ws targets list.
     *
     * Apparently, the sole existence of the runtime on the list doesn't tell if it is really running. Metro has some
     * internal logic that keeps the runtimes listed for some time after they've been terminated. However, when the
     * runtime is not listed it is sufficient to conclude that it is not running.
     *
     * We therefore use Promise.any for this check and expect the 2nd check to only return when the runtime isn't listed
     * but otherwise we want it to throw and wait for the ping check to finish. In addition the ping check is guarded by
     * a timeout as when the runtime is disconnected the evaluate call is never picked up bu the runtime and we will never
     * get a response back.
     */
    return Promise.any([
      this.pingJsDebugSessionWithTimeout(),
      this.isCurrentWsTargetStillVisible(metro),
    ]);
  }

  public async isCurrentWsTargetStillVisible(metro: Metro) {
    const possibleWsTargets = await metro.fetchWsTargets();
    const hasCurrentWsAddress = possibleWsTargets?.some(
      (runtime) => runtime.webSocketDebuggerUrl === this.currentWsTarget
    );

    if (!this.currentWsTarget || !hasCurrentWsAddress) {
      return false;
    }
    // We're rejecting as shouldDebuggerReconnect uses .any which waits for first promise to resolve.
    // And th fact that current wsTarget is on the list is not enough, it might be stale, so in this case we wait for ping.
    throw new Error("current ws target is still");
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
