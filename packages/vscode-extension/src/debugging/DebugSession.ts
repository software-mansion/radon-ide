import {
  debug,
  DebugSessionCustomEvent,
  Disposable,
  DebugSession as VscDebugSession,
} from "vscode";

export type DebugSessionDelegate = {
  onConsoleLog(event: DebugSessionCustomEvent): void;
  onDebuggerPaused(event: DebugSessionCustomEvent): void;
  onDebuggerResumed(event: DebugSessionCustomEvent): void;
};

export class DebugSession implements Disposable {
  private _session: VscDebugSession | undefined;
  private debugEventsListener: Disposable;

  constructor(private debuggerUrl: string, private delegate: DebugSessionDelegate) {
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
    this.session && debug.stopDebugging(this.session);
    this.debugEventsListener.dispose();
  }

  public async start() {
    const debugStarted = await debug.startDebugging(
      undefined,
      {
        type: "com.swmansion.react-native-ide",
        name: "React Native IDE Debugger",
        request: "attach",
        websocketAddress: this.debuggerUrl,
      },
      {
        suppressDebugStatusbar: true,
        suppressDebugView: true,
        suppressDebugToolbar: true,
        suppressSaveBeforeStart: true,
      }
    );
    if (debugStarted) {
      this._session = debug.activeDebugSession!;
      return true;
    }
    return false;
  }

  public resumeDebugger() {
    this.session.customRequest("continue");
  }

  public stepOverDebugger() {
    this.session.customRequest("next");
  }

  private get session() {
    if (!this._session) {
      throw new Error("Debugger not started");
    }
    return this._session;
  }
}
