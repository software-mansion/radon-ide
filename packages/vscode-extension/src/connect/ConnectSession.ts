import { Disposable } from "vscode";
import { DebugSession, DebugSessionImpl } from "../debugging/DebugSession";
import { Metro } from "../project/metro";
import { BaseInspectorBridge } from "../project/bridge";
import { disposeAll } from "../utilities/disposables";

export interface ConnectSessionDelegate {
  onSessionTerminated: () => void;
}

class DebugSessionInspectorBridge extends BaseInspectorBridge {
  constructor(private readonly debugSession: DebugSession) {
    super();
  }

  onBindingCalled(event: any) {
    const { name, payload } = event as { name: string; payload: string };
    if (name === "__radon_binding") {
      const { type, data } = JSON.parse(payload);
      this.emitEvent(type, data);
    }
  }

  protected send(message: unknown) {
    this.debugSession.evaluateExpression({
      expression: `globalThis.__radon_dispatch(${JSON.stringify(message)});`,
    });
  }
}

export default class ConnectSession implements Disposable {
  private debugSession: DebugSession & Disposable;
  private debugEventsSubscription: Disposable;
  public readonly inspectorBridge: DebugSessionInspectorBridge;

  public get port() {
    return this.metro.port;
  }

  constructor(
    private readonly metro: Metro,
    private readonly delegate: ConnectSessionDelegate
  ) {
    this.debugSession = new DebugSessionImpl({
      suppressDebugToolbar: false,
      displayName: "Radon Connect Debugger",
    });
    this.debugEventsSubscription = this.registerDebugSessionListeners();
    this.inspectorBridge = new DebugSessionInspectorBridge(this.debugSession);
  }

  public async start(websocketAddress: string) {
    const isUsingNewDebugger = this.metro.isUsingNewDebugger;
    if (!isUsingNewDebugger) {
      throw new Error("Auto-connect is only supported for the new React Native debugger");
    }
    await this.debugSession.startJSDebugSession({
      websocketAddress,
      displayDebuggerOverlay: true,
      installConnectRuntime: true,
      isUsingNewDebugger,
      expoPreludeLineCount: this.metro.expoPreludeLineCount,
      sourceMapPathOverrides: this.metro.sourceMapPathOverrides,
    });
  }

  private registerDebugSessionListeners(): Disposable {
    const subscriptions = [
      this.debugSession.onDebugSessionTerminated(() => {
        this.delegate.onSessionTerminated();
      }),
      this.debugSession.onBindingCalled((event: unknown) => {
        this.inspectorBridge.onBindingCalled(event);
      }),
    ];
    return new Disposable(() => {
      disposeAll(subscriptions);
    });
  }

  dispose() {
    this.debugSession.dispose();
    this.debugEventsSubscription.dispose();
  }
}
