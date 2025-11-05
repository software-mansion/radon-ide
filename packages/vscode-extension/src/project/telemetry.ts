import { Disposable, env, Uri } from "vscode";
import { StateManager } from "./StateManager";
import { TelemetryState } from "../common/State";
import { disposeAll } from "../utilities/disposables";
import { getTelemetryReporter } from "../utilities/telemetry";
import { TelemetryEventProperties } from "@vscode/extension-telemetry";

export class Telemetry implements Disposable {
  private disposables: Disposable[] = [];

  constructor(private readonly stateManager: StateManager<TelemetryState>) {
    const isTelemetryEnabled = env.isTelemetryEnabled;

    this.stateManager.updateState({ enabled: isTelemetryEnabled });

    this.disposables.push(
      env.onDidChangeTelemetryEnabled((telemetryEnabled) => {
        this.stateManager.updateState({ enabled: telemetryEnabled });
      })
    );

    this.disposables.push(this.stateManager);
  }

  public async reportIssue() {
    env.openExternal(Uri.parse("https://github.com/software-mansion/radon-ide/issues/new/choose"));
  }

  public async sendTelemetry(eventName: string, properties?: TelemetryEventProperties) {
    getTelemetryReporter().sendTelemetryEvent(eventName, properties);
  }

  public dispose(): void {
    disposeAll(this.disposables);
  }
}
