import {
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

    let sourceMapAliases: Array<[string, string]> = [];
    const isUsingNewDebugger = this.metro.isUsingNewDebugger;
    if (isUsingNewDebugger && this.metro.watchFolders.length > 0) {
      // first entry in watchFolders is the project root
      sourceMapAliases.push(["/[metro-project]/", this.metro.watchFolders[0]]);
      this.metro.watchFolders.forEach((watchFolder, index) => {
        sourceMapAliases.push([`/[metro-watchFolders]/${index}/`, watchFolder]);
      });
    }

    const debugStarted = await debug.startDebugging(
      undefined,
      {
        type: "com.swmansion.react-native-debugger",
        name: "Radon IDE Debugger",
        request: "attach",
        websocketAddress: websocketAddress,
        sourceMapAliases,
        expoPreludeLineCount: this.metro.expoPreludeLineCount,
        breakpointsAreRemovedOnContextCleared: isUsingNewDebugger ? false : true, // new debugger properly keeps all breakpoints in between JS reloads
      },
      {
        suppressDebugStatusbar: true,
        suppressDebugView: true,
        suppressDebugToolbar: true,
        suppressSaveBeforeStart: true,
      }
    );

    if (debugStarted) {
      this.vscSession = debug.activeDebugSession!;
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
    this.session.customRequest("continue");
  }

  public stepOverDebugger() {
    this.session.customRequest("next");
  }

  private get session() {
    if (!this.vscSession) {
      throw new Error("Debugger not started");
    }
    return this.vscSession;
  }
}
