import assert from "assert";
import {
  commands,
  debug,
  DebugSessionCustomEvent,
  Disposable,
  DebugSession as VscDebugSession,
} from "vscode";
import { Metro } from "../project/metro";
import { Logger } from "../Logger";
import { CDPConfiguration } from "./DebugAdapter";

const PING_TIMEOUT = 1000;

export const DEBUG_CONSOLE_LOG = "RNIDE_consoleLog";
export const DEBUG_PAUSED = "RNIDE_paused";
export const DEBUG_RESUMED = "RNIDE_continued";
export const DEBUG_DISCONNECTED = "RNIDE_disconnected";

export type DebugSessionDelegate = {
  onConsoleLog(event: DebugSessionCustomEvent): void;
  onDebuggerPaused(event: DebugSessionCustomEvent): void;
  onDebuggerResumed(event: DebugSessionCustomEvent): void;
  onProfilingCPUStarted(event: DebugSessionCustomEvent): void;
  onProfilingCPUStopped(event: DebugSessionCustomEvent): void;
};

export type DebugSource = { filename?: string; line1based?: number; column0based?: number };

const REACT_NATIVE_SESSION_TYPE = "com.swmansion.react-native-debugger";

export class DebugSession implements Disposable {
  private vscSession: VscDebugSession | undefined;
  private debugEventsListener: Disposable;
  private pingTimeout: NodeJS.Timeout | undefined;
  private pingResolve: ((result: boolean) => void) | undefined;
  private wasConnectedToCDP: boolean = false;
  private currentWsTarget: string | undefined;

  constructor(private delegate: DebugSessionDelegate) {
    this.debugEventsListener = debug.onDidReceiveDebugSessionCustomEvent((event) => {
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
        case "RNIDE_pong":
          if (this.pingResolve) {
            this.pingResolve(true);
          } else {
            Logger.warn("[DEBUG SESSION] Received unexpected pong event");
          }
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
    });
  }

  public async reconnectJSDebuggerIfNeeded(metro: Metro) {
    const isAlive = await this.isWsTargetAlive(metro);

    if (!isAlive) {
      return this.connectJSDebugger(metro);
    }

    return true;
  }

  private async startInternal() {
    let didStartHandler: Disposable | null = debug.onDidStartDebugSession((session) => {
      if (session.type === REACT_NATIVE_SESSION_TYPE) {
        this.vscSession = session;
        didStartHandler?.dispose();
        didStartHandler = null;
      }
    });
    try {
      const debugStarted = await debug.startDebugging(
        undefined,
        {
          type: REACT_NATIVE_SESSION_TYPE,
          name: "React Native Preview Debugger",
          request: "attach",
        },
        {
          suppressDebugStatusbar: true,
          suppressDebugView: true,
          suppressDebugToolbar: true,
          suppressSaveBeforeStart: true,
        }
      );

      if (debugStarted) {
        // NOTE: this is safe, because `debugStarted` means the session started successfully,
        // and we set the session in the `onDidStartDebugSession` handler
        assert(this.vscSession, "Expected debug session to be set");
        return true;
      }
    } finally {
      didStartHandler?.dispose();
    }
  }

  public static start(debugEventDelegate: DebugSessionDelegate) {
    const debugSession = new DebugSession(debugEventDelegate);
    debugSession.startInternal();
    return debugSession;
  }

  public async getOriginalSource(
    fileName: string,
    line0Based: number,
    column0Based: number
  ): Promise<{ sourceURL: string; lineNumber1Based: number; columnNumber0Based: number }> {
    return await this.session.customRequest("source", { fileName, line0Based, column0Based });
  }

  public async restart() {
    await this.stop();
    await this.startInternal();
  }

  private async stop() {
    this.vscSession && (await debug.stopDebugging(this.vscSession));
    this.vscSession = undefined;
    this.wasConnectedToCDP = false;
    this.currentWsTarget = undefined;
  }

  /**
  This method is async to allow for awaiting it during restarts, please keep in mind tho that
  build in vscode dispose system ignores async keyword and works synchronously.
  */
  public async dispose() {
    this.vscSession && (await debug.stopDebugging(this.vscSession));
    this.debugEventsListener.dispose();
  }

  public async connectJSDebugger(metro: Metro) {
    if (this.wasConnectedToCDP) {
      await this.restart();
    }

    const websocketAddress = await metro.getDebuggerURL();
    if (!websocketAddress) {
      return false;
    }

    const isUsingNewDebugger = metro.isUsingNewDebugger.valueOf();

    await this.connectCDPDebugger({
      websocketAddress,
      metroWatchFolders: metro.watchFolders,
      expoPreludeLineCount: metro.expoPreludeLineCount,
      isUsingNewDebugger,
    });

    this.wasConnectedToCDP = true;
    this.currentWsTarget = websocketAddress;

    return true;
  }

  public resumeDebugger() {
    commands.executeCommand("workbench.action.debug.continue", undefined, {
      sessionId: this.vscSession?.id,
    });
  }

  public stepOverDebugger() {
    commands.executeCommand("workbench.action.debug.stepOver", undefined, {
      sessionId: this.vscSession?.id,
    });
  }

  public async isWsTargetAlive(metro: Metro): Promise<boolean> {
    /**
     * This is a bit tricky, the idea is that we run both checks.
     * pingCurrentWsTarget provides us reliable information about connection.
     * isCurrentWsTargetStillVisible can say reliably only if the connection were lost (is missing on ws targets list).
     * So what we do is promise any, but isCurrentWsTargetStillVisible rejects promise if the connection is on the list, so
     * we can wait for ping to resolve.
     */
    return Promise.any([this.pingCurrentWsTarget(), this.isCurrentWsTargetStillVisible(metro)]);
  }

  public async isCurrentWsTargetStillVisible(metro: Metro): Promise<boolean> {
    return new Promise(async (resolve, reject) => {
      const possibleWsTargets = await metro.fetchWsTargets();
      const hasCurrentWsAddress = possibleWsTargets?.some(
        (runtime) => runtime.webSocketDebuggerUrl === this.currentWsTarget
      );

      if (!this.currentWsTarget || !hasCurrentWsAddress) {
        return resolve(false);
      }
      // We're rejecting as shouldDebuggerReconnect uses .any which waits for first promise to resolve.
      // And th fact that current wsTarget is on the list is not enough, it might be stale, so in this case we wait for ping.
      reject();
    });
  }

  public async pingCurrentWsTarget(): Promise<boolean> {
    this.session.customRequest("RNIDE_ping");
    return new Promise((resolve, _) => {
      this.pingResolve = (value) => {
        clearTimeout(this.pingTimeout);
        resolve(value);
        this.pingResolve = undefined;
        this.pingTimeout = undefined;
      };
      this.pingTimeout = setTimeout(() => {
        this.pingResolve?.(false);
      }, PING_TIMEOUT);
    });
  }

  public async startProfilingCPU() {
    await this.session.customRequest("RNIDE_startProfiling");
  }

  public async stopProfilingCPU() {
    await this.session.customRequest("RNIDE_stopProfiling");
  }

  private async connectCDPDebugger(cdpConfiguration: CDPConfiguration) {
    await this.session.customRequest("RNIDE_connect_cdp_debugger", cdpConfiguration);
  }

  public async appendDebugConsoleEntry(message: string, type: string, source?: DebugSource) {
    await this.session.customRequest("RNIDE_log_message", { message, type, source });
  }

  private get session() {
    if (!this.vscSession) {
      throw new Error("Debugger not started");
    }
    return this.vscSession;
  }
}
