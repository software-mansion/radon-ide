import { EventEmitter, Disposable } from "vscode";
import { Cdp } from "vscode-cdp-proxy";
import { Metro } from "../project/metro";
import { CancelToken } from "../utilities/cancelToken";
import { sleep } from "../utilities/retry";
import { DebugSession, DebugSource, JSDebugConfiguration } from "./DebugSession";
import { disposeAll } from "../utilities/disposables";
import { DevtoolsServer } from "../project/devtools";

const PING_TIMEOUT = 1000;
export class ReconnectingDebugSession implements DebugSession, Disposable {
  private disposables: Disposable[] = [];
  private reconnectCancelToken: CancelToken | undefined;
  private readonly sessionTerminatedEventEmitter = new EventEmitter<void>();

  private isRunning: boolean = false;

  public readonly onDebugSessionTerminated = this.sessionTerminatedEventEmitter.event;

  constructor(
    private readonly debugSession: DebugSession & Partial<Disposable>,
    private readonly metro: Metro,
    devtoolsServer?: DevtoolsServer
  ) {
    this.disposables.push(debugSession.onDebugSessionTerminated(this.maybeReconnect));
    if (devtoolsServer) {
      // NOTE: with Expo Go on Android, the debugger can become unresponsive after a JS reload.
      // Since a JS reload causes the devtools to reconnect, we can use that as a hint to reconnect the debugger.
      this.disposables.push(devtoolsServer.onConnection(this.maybeReconnect));
    }
  }

  public async startJSDebugSession(configuration: JSDebugConfiguration) {
    this.isRunning = true;
    if (this.reconnectCancelToken) {
      this.reconnectCancelToken.cancel();
      this.reconnectCancelToken = undefined;
    }
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
    if (!this.isRunning || this.reconnectCancelToken !== undefined) {
      return;
    }
    const cancelToken = new CancelToken();
    this.reconnectCancelToken = cancelToken;
    while (this.isRunning && !cancelToken.cancelled) {
      try {
        const connected = await cancelToken.adapt(this.pingJsDebugSessionWithTimeout());
        if (connected) {
          // if we're connected to a responsive session, we can break
          break;
        }
        const websocketAddress = await this.metro.getDebuggerURL(undefined, cancelToken);
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
        break;
      } catch (e) {
        // we ignore the errors and retry
      }
    }
    if (this.reconnectCancelToken === cancelToken) {
      this.reconnectCancelToken = undefined;
    }
  };

  async dispose() {
    disposeAll(this.disposables);
    this.reconnectCancelToken?.cancel();
    this.sessionTerminatedEventEmitter.fire();
    this.sessionTerminatedEventEmitter.dispose();
    await this.debugSession.dispose?.();
  }

  // #region DebugSession methods delegated to the decorated object
  public onConsoleLog = this.debugSession.onConsoleLog;
  public onDebuggerPaused = this.debugSession.onDebuggerPaused;
  public onDebuggerResumed = this.debugSession.onDebuggerResumed;
  public onProfilingCPUStarted = this.debugSession.onProfilingCPUStarted;
  public onProfilingCPUStopped = this.debugSession.onProfilingCPUStopped;
  public onBindingCalled = this.debugSession.onBindingCalled;
  public onBundleParsed = this.debugSession.onBundleParsed;

  public async startParentDebugSession(): Promise<void> {
    return this.debugSession.startParentDebugSession();
  }
  public async restart(): Promise<void> {
    this.isRunning = false;
    if (this.reconnectCancelToken) {
      this.reconnectCancelToken.cancel();
      this.reconnectCancelToken = undefined;
    }
    return this.debugSession.restart();
  }
  public resumeDebugger(): void {
    this.debugSession.resumeDebugger();
  }
  public stepOverDebugger(): void {
    this.debugSession.stepOverDebugger();
  }
  public stepOutDebugger() {
    this.debugSession.stepOutDebugger();
  }
  public stepIntoDebugger() {
    this.debugSession.stepIntoDebugger();
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
  public async addBinding(name: string): Promise<void> {
    return this.debugSession.addBinding(name);
  }
}
