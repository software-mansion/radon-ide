import {
  commands,
  debug,
  DebugSessionCustomEvent,
  Disposable,
  DebugSession as VscDebugSession,
} from "vscode";
import { Metro } from "../project/metro";
import { CDPProxy } from "./CDPProxy";
import { RadonCDPProxyDelegate } from "./RadonCDPProxyDelegate";

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

    if (isUsingNewDebugger) {
      const sourceMapAliases: Array<[string, string]> = [];
      if (isUsingNewDebugger && this.metro.watchFolders.length > 0) {
        // first entry in watchFolders is the project root
        sourceMapAliases.push(["/[metro-project]/", this.metro.watchFolders[0]]);
        this.metro.watchFolders.forEach((watchFolder, index) => {
          sourceMapAliases.push([`/[metro-watchFolders]/${index}/`, watchFolder]);
        });
      }

      const cdpProxyPort = Math.round(Math.random() * 40000 + 3000);

      const cdpProxy = new CDPProxy(
        "127.0.0.1",
        cdpProxyPort,
        websocketAddress,
        new RadonCDPProxyDelegate(this.delegate)
      );
      await cdpProxy.initializeServer();

      debugStarted = await debug.startDebugging(
        undefined,
        {
          type: "pwa-node",
          name: "Radon IDE Debugger",
          request: "attach",
          port: cdpProxyPort,
          sourceMapPathOverrides: Object.fromEntries(
            sourceMapAliases.map(([alias, path]) => [`${alias}*`, `${path}/*`])
          ),
          resolveSourceMapLocations: ["**", "!**/node_modules/!(expo)/**"],
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
    // this.session.customRequest("continue");
    commands.executeCommand("workbench.action.debug.continue");
  }

  public stepOverDebugger() {
    // this.session.customRequest("next");
    commands.executeCommand("workbench.action.debug.stepOver");
  }

  private get session() {
    if (!this.vscSession) {
      throw new Error("Debugger not started");
    }
    return this.vscSession;
  }
}
