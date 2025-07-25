import { DebugSessionCustomEvent, Disposable, Event } from "vscode";
import { Cdp } from "vscode-cdp-proxy";
import { Metro } from "../project/metro";
import { CancelToken } from "../utilities/cancelToken";
import { sleep } from "../utilities/retry";
import { DebugSession, DebugSource, JSDebugConfiguration } from "./DebugSession";
import { Devtools } from "../project/devtools";
import { disposeAll } from "../utilities/disposables";

const PING_TIMEOUT = 1000;
export class ReconnectingDebugSession implements DebugSession, Disposable {
  private disposables: Disposable[] = [];
  private cancelReconnect: CancelToken | undefined;

  private isRunning: boolean = false;

  constructor(
    private readonly debugSession: DebugSession & Partial<Disposable>,
    private readonly metro: Metro,
    devtools: Devtools
  ) {
    this.disposables.push(debugSession.onDebugSessionTerminated(this.maybeReconnect));
    this.disposables.push(devtools.onEvent("appReady", this.maybeReconnect));
  }

  public async startJSDebugSession(configuration: JSDebugConfiguration) {
    this.isRunning = true;
    return this.debugSession.startJSDebugSession(configuration);
  }

  private async pingJsDebugSessionWithTimeout() {
    const resultPromise = this.debugSession
      .evaluateExpression({ expression: "('ping')" })
      .then((response) => {
        return response.result.value === "ping";
      });
    const timeout = sleep(PING_TIMEOUT).then(() => {
      throw new Error("Ping timeout");
    });
    return Promise.race([resultPromise, timeout]).catch((_e) => false);
  }

  private maybeReconnect = async () => {
    if (!this.isRunning || this.cancelReconnect !== undefined) {
      return;
    }
    this.cancelReconnect = new CancelToken();
    while (this.isRunning && !this.cancelReconnect.cancelled) {
      try {
        const connected = await this.pingJsDebugSessionWithTimeout();
        if (connected) {
          // if we're connected to a responsive session, we can break
          break;
        }
        const websocketAddress = await this.metro.getDebuggerURL(undefined, this.cancelReconnect);
        if (!websocketAddress) {
          throw new Error("No connected device listed");
        }
        await this.debugSession.startJSDebugSession({
          websocketAddress,
          displayDebuggerOverlay: false,
          isUsingNewDebugger: this.metro.isUsingNewDebugger,
          expoPreludeLineCount: this.metro.expoPreludeLineCount,
          sourceMapPathOverrides: this.metro.sourceMapPathOverrides,
        });
      } catch (e) {
        // we ignore the errors and retry
      }
    }
    this.cancelReconnect = undefined;
  };

  async dispose() {
    disposeAll(this.disposables);
    this.cancelReconnect?.cancel();
    await this.debugSession.dispose?.();
  }

  // Delegate DebugSession methods to the decorated object
  public get onConsoleLog(): Event<DebugSessionCustomEvent> {
    return this.debugSession.onConsoleLog;
  }
  public get onDebuggerPaused(): Event<DebugSessionCustomEvent> {
    return this.debugSession.onDebuggerPaused;
  }
  public get onDebuggerResumed(): Event<DebugSessionCustomEvent> {
    return this.debugSession.onDebuggerResumed;
  }
  public get onProfilingCPUStarted(): Event<DebugSessionCustomEvent> {
    return this.debugSession.onProfilingCPUStarted;
  }
  public get onProfilingCPUStopped(): Event<DebugSessionCustomEvent> {
    return this.debugSession.onProfilingCPUStopped;
  }
  public get onBindingCalled(): Event<DebugSessionCustomEvent> {
    return this.debugSession.onBindingCalled;
  }
  public get onDebugSessionTerminated(): Event<void> {
    return this.debugSession.onDebugSessionTerminated;
  }
  public async startParentDebugSession(): Promise<void> {
    return this.debugSession.startParentDebugSession();
  }
  public async restart(): Promise<void> {
    return this.debugSession.restart();
  }
  public resumeDebugger(): void {
    this.debugSession.resumeDebugger();
  }
  public stepOverDebugger(): void {
    this.debugSession.stepOverDebugger();
  }
  public async startProfilingCPU(): Promise<void> {
    return this.debugSession.startProfilingCPU();
  }
  public async stopProfilingCPU(): Promise<void> {
    return this.debugSession.stopProfilingCPU();
  }
  public async appendDebugConsoleEntry(
    message: string,
    type: string,
    source?: DebugSource
  ): Promise<void> {
    return this.debugSession.appendDebugConsoleEntry(message, type, source);
  }
  public async evaluateExpression(
    params: Cdp.Runtime.EvaluateParams
  ): Promise<Cdp.Runtime.EvaluateResult> {
    return this.debugSession.evaluateExpression(params);
  }
}
