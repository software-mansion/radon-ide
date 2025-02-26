import path from "path";
import assert from "assert";
import {
  commands,
  debug,
  DebugSessionCustomEvent,
  Disposable,
  DebugSession as VscDebugSession,
} from "vscode";
import { Metro } from "../project/metro";

export type DebugSessionDelegate = {
  onConsoleLog(event: DebugSessionCustomEvent): void;
  onDebuggerPaused(event: DebugSessionCustomEvent): void;
  onDebuggerResumed(event: DebugSessionCustomEvent): void;
};

export class DebugSession implements Disposable {
  private vscSession: VscDebugSession | undefined;
  private debugEventsListener: Disposable;

  constructor(private metro: Metro, private delegate: DebugSessionDelegate) {
    this.debugEventsListener = debug.onDidReceiveDebugSessionCustomEvent((event) => {
      switch (event.event) {
        case "RNIDE_consoleLog":
          this.delegate.onConsoleLog(event);
          break;
        case "RNIDE_paused":
          this.delegate.onDebuggerPaused(event);
          break;
        case "RNIDE_continued":
          this.delegate.onDebuggerResumed(event);
          break;
        default:
          // ignore other events
          break;
      }
    });
  }

  public dispose() {
    this.vscSession && debug.stopDebugging(this.vscSession);
    this.debugEventsListener.dispose();
  }

  public async start() {
    const websocketAddress = await this.metro.getDebuggerURL();
    if (!websocketAddress) {
      return false;
    }

    let debugStarted = false;
    const isUsingNewDebugger = this.metro.isUsingNewDebugger;

    this.vscSession = undefined;

    const unsub = debug.onDidStartDebugSession((session) => {
      if (session.type.startsWith("com.swmansion.")) {
        this.vscSession = session;
        unsub.dispose();
      }
    });

    if (isUsingNewDebugger) {
      const sourceMapPathOverrides: Record<string, string> = {};
      if (this.metro.watchFolders.length > 0) {
        sourceMapPathOverrides["/[metro-project]/*"] = `${this.metro.watchFolders[0]}${path.sep}*`;
        this.metro.watchFolders.forEach((watchFolder, index) => {
          sourceMapPathOverrides[`/[metro-watchFolders]/${index}/*`] = `${watchFolder}${path.sep}*`;
        });
      }

      debugStarted = await debug.startDebugging(
        undefined,
        {
          type: "com.swmansion.proxy-debugger",
          name: "Radon IDE Debugger",
          request: "attach",
          websocketAddress,
          sourceMapPathOverrides,
        },
        {
          suppressDebugStatusbar: true,
          suppressDebugView: true,
          suppressDebugToolbar: true,
          suppressSaveBeforeStart: true,
        }
      );
    } else {
      debugStarted = await debug.startDebugging(
        undefined,
        {
          type: "com.swmansion.react-native-debugger",
          name: "Radon IDE Debugger",
          request: "attach",
          websocketAddress: websocketAddress,
          expoPreludeLineCount: this.metro.expoPreludeLineCount,
          breakpointsAreRemovedOnContextCleared: true,
        },
        {
          suppressDebugStatusbar: true,
          suppressDebugView: true,
          suppressDebugToolbar: true,
          suppressSaveBeforeStart: true,
        }
      );
    }

    if (debugStarted) {
      assert(this.vscSession);
      return true;
    }
    return false;
  }

  public async getOriginalSource(
    fileName: string,
    line0Based: number,
    column0Based: number
  ): Promise<{ sourceURL: string; lineNumber1Based: number; columnNumber0Based: number }> {
    return await this.session.customRequest("source", { fileName, line0Based, column0Based });
  }

  public resumeDebugger() {
    commands.executeCommand("workbench.action.debug.continue", undefined, {
      sessionId: this.session.id,
    });
  }

  public stepOverDebugger() {
    commands.executeCommand("workbench.action.debug.stepOver", undefined, {
      sessionId: this.session.id,
    });
  }

  private get session() {
    if (!this.vscSession) {
      throw new Error("Debugger not started");
    }
    return this.vscSession;
  }
}
