import { Disposable, env } from "vscode";
import { StateManager } from "./StateManager";
import { TelemetryState } from "../common/State";
import { disposeAll } from "../utilities/disposables";

export class Telemetry implements Disposable {
  private disposables: Disposable[] = [];

  constructor(private readonly stateManager: StateManager<TelemetryState>) {
    const isTelemetryEnabled = env.isTelemetryEnabled;

    this.stateManager.setState({ enabled: isTelemetryEnabled });

    this.disposables.push(
      env.onDidChangeTelemetryEnabled((telemetryEnabled) => {
        this.stateManager.setState({ enabled: telemetryEnabled });
      })
    );

    this.disposables.push(this.stateManager);
  }

  dispose(): void {
    disposeAll(this.disposables);
  }
}
