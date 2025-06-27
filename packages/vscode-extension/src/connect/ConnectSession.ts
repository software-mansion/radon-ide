import { DebugSession } from "../debugging/DebugSession";
import { Metro } from "../project/metro";
import { Disposable } from "vscode";
import { BaseInspectorBridge } from "../project/bridge";

export interface ConnectSessionDelegate {
  onSessionTerminated: () => void;
}

class DebugSessionInspectorBridge extends BaseInspectorBridge {
  constructor(private readonly debugSession: DebugSession) {
    super();
  }

  onBindingCalled(event: any) {
    const { name, payload } = event.body as { name: string; payload: string };
    if (name === "__radon_binding") {
      const { type, data } = JSON.parse(payload);
      this.emitEvent(type, data);
    }
  }

  protected send(message: any) {
    this.debugSession.postMessage(message);
  }
}

export default class ConnectSession implements Disposable {
  private debugSession: DebugSession;
  public readonly inspectorBridge: DebugSessionInspectorBridge;

  public get port() {
    return this.metro.port;
  }

  constructor(
    private readonly metro: Metro,
    private readonly delegate: ConnectSessionDelegate
  ) {
    this.debugSession = new DebugSession({
      onDebugSessionTerminated: () => {
        this.delegate.onSessionTerminated();
      },
      onBindingCalled: (event: any) => {
        this.inspectorBridge.onBindingCalled(event);
      },
    });
    this.inspectorBridge = new DebugSessionInspectorBridge(this.debugSession);
  }

  public async start(websocketAddress: string) {
    const isUsingNewDebugger = this.metro.isUsingNewDebugger;
    if (!isUsingNewDebugger) {
      throw new Error("Auto-connect is only supported for the new React Native debugger");
    }
    const success = await this.debugSession.startJSDebugSession({
      websocketAddress,
      displayDebuggerOverlay: true,
      isUsingNewDebugger,
      expoPreludeLineCount: this.metro.expoPreludeLineCount,
      sourceMapPathOverrides: this.metro.sourceMapPathOverrides,
    });
    return success;
  }

  dispose() {
    this.debugSession.dispose();
  }
}
