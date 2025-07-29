import { Disposable, env } from "vscode";
import { StateManager } from "./StateManager";
import { TelemetryState } from "../common/State";

export class TelemetryManager implements Disposable {
  constructor(private readonly stateManager: StateManager<TelemetryState>) {
    const isTelemetryEnabled = env.isTelemetryEnabled;

    this.stateManager.setState({ enabled: isTelemetryEnabled });

    env.onDidChangeTelemetryEnabled((telemetryEnabled) => {
      this.stateManager.setState({ enabled: telemetryEnabled });
    });
  }

  dispose(): void {
    this.stateManager.dispose();
  }
}
