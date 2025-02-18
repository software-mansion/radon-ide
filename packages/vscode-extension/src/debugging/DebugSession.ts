import {
  debug,
  DebugSessionCustomEvent,
  Disposable,
  DebugSession as VscDebugSession,
} from "vscode";
import { Metro } from "../project/metro";
import { CDPConfiguration } from "./DebugAdapter";

export type DebugSessionDelegate = {
  onConsoleLog(event: DebugSessionCustomEvent): void;
  onDebuggerPaused(event: DebugSessionCustomEvent): void;
  onDebuggerResumed(event: DebugSessionCustomEvent): void;
};

export type DebugSource = { filename?: string; line1based?: number; column0based?: number };

export class DebugSession implements Disposable {
  private vscSession: VscDebugSession | undefined;
  private debugEventsListener: Disposable;
  private wasConnectedToCDP: boolean = false;

  constructor(private delegate: DebugSessionDelegate) {
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

  public async startDebugSession() {
    const debugStarted = await debug.startDebugging(
      undefined,
      {
        type: "com.swmansion.react-native-debugger",
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

    if (debugStarted) {
      this.vscSession = debug.activeDebugSession!;
      return true;
    }
    return false;
  }

  public async stopDebugSession() {
    this.vscSession && (await debug.stopDebugging(this.vscSession));
  }

  public dispose() {
    this.vscSession && debug.stopDebugging(this.vscSession);
    this.debugEventsListener.dispose();
  }

  public async connectToApplication(metro: Metro) {
    if (this.wasConnectedToCDP) {
      this.vscSession && debug.stopDebugging(this.vscSession);
      await this.startDebugSession();
    }

    const websocketAddress = await metro.getDebuggerURL();
    if (!websocketAddress) {
      return false;
    }

    let sourceMapAliases: Array<[string, string]> = [];
    const isUsingNewDebugger = metro.isUsingNewDebugger;
    if (isUsingNewDebugger && metro.watchFolders.length > 0) {
      // first entry in watchFolders is the project root
      sourceMapAliases.push(["/[metro-project]/", metro.watchFolders[0]]);
      metro.watchFolders.forEach((watchFolder, index) => {
        sourceMapAliases.push([`/[metro-watchFolders]/${index}/`, watchFolder]);
      });
    }

    await this.connectCDPDebugger({
      websocketAddress: websocketAddress,
      sourceMapAliases,
      expoPreludeLineCount: metro.expoPreludeLineCount,
      breakpointsAreRemovedOnContextCleared: isUsingNewDebugger ? false : true, // new debugger properly keeps all breakpoints in between JS reloads
    });

    this.wasConnectedToCDP = true;

    return true;
  }

  public resumeDebugger() {
    this.session.customRequest("continue");
  }

  public stepOverDebugger() {
    this.session.customRequest("next");
  }

  private async connectCDPDebugger(cdpConfiguration: CDPConfiguration) {
    await this.session.customRequest("RNIDE_connect_cdp_debugger", cdpConfiguration);
  }

  public async sendDebugConsoleLog(message: string, source?: DebugSource) {
    await this.session.customRequest("RNIDE_log_message", { message, source });
  }

  private get session() {
    if (!this.vscSession) {
      throw new Error("Debugger not started");
    }
    return this.vscSession;
  }
}
