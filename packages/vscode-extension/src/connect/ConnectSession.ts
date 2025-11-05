import path from "path";
import fs from "fs";
import { Disposable } from "vscode";
import { DebugSession, DebugSessionImpl } from "../debugging/DebugSession";
import { MetroSession } from "../project/metro";
import { InspectorBridge } from "../project/inspectorBridge";
import { disposeAll } from "../utilities/disposables";
import { extensionContext } from "../utilities/extensionContext";
import { Logger } from "../Logger";
import { getTelemetryReporter } from "../utilities/telemetry";

export interface ConnectSessionDelegate {
  onSessionTerminated: () => void;
}

class DebugSessionInspectorBridge extends InspectorBridge {
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
    private readonly metro: MetroSession,
    private readonly delegate: ConnectSessionDelegate
  ) {
    this.debugSession = new DebugSessionImpl({
      suppressDebugToolbar: false,
      displayName: "Radon Connect Debugger",
    });
    this.debugEventsSubscription = this.registerDebugSessionListeners();
    this.inspectorBridge = new DebugSessionInspectorBridge(this.debugSession);
  }

  public async start(websocketAddress: string, isUsingNewDebugger: boolean) {
    if (!isUsingNewDebugger) {
      throw new Error("Auto-connect is only supported for the new React Native debugger");
    }
    await this.debugSession.startJSDebugSession({
      websocketAddress,
      displayDebuggerOverlay: true,
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
      this.debugSession.onScriptParsed(({ isMainBundle }) => {
        if (isMainBundle) {
          this.setupRadonConnectRuntime();
        }
      }),
    ];
    return new Disposable(() => {
      disposeAll(subscriptions);
    });
  }

  private async setupRadonConnectRuntime() {
    try {
      // load script from lib/connect_runtime.js and evaluate it
      const runtimeScriptPath = path.join(
        extensionContext.extensionPath,
        "dist",
        "connect_runtime.js"
      );
      const runtimeScript = await fs.promises.readFile(runtimeScriptPath, "utf8");

      await this.debugSession.addBinding("__radon_binding");

      const result = await this.debugSession.evaluateExpression({
        expression: runtimeScript,
      });
      if (result.exceptionDetails) {
        Logger.error("Failed to setup Radon Connect runtime", result.exceptionDetails);
        getTelemetryReporter().sendTelemetryEvent("radon-connect:setup-runtime-error", {
          error: result.exceptionDetails.exception?.description ?? "Unknown error",
        });
      }
    } catch (e) {
      const errorMessage = (e as Error).message;
      Logger.error("Failed to setup Radon Connect runtime", e);
      getTelemetryReporter().sendTelemetryEvent("radon-connect:setup-runtime-error", {
        error: errorMessage || "Unknown error",
      });
    }
  }

  dispose() {
    this.debugSession.dispose();
    this.debugEventsSubscription.dispose();
  }
}
