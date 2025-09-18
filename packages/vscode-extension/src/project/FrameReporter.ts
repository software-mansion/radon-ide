import { Disposable } from "vscode";
import { FrameRateReport, FrameReportingState } from "../common/State";
import { StateManager } from "./StateManager";
import { DeviceBase } from "../devices/DeviceBase";
import { disposeAll } from "../utilities/disposables";

export class FrameReporter implements Disposable {
  private disposables: Disposable[] = [];

  constructor(
    private readonly stateManager: StateManager<FrameReportingState>,
    private device: DeviceBase
  ) {
    this.disposables.push(
      new Disposable(() => {
        this.device.stopReportingFrameRate();
      })
    );

    this.disposables.push(this.stateManager);
  }

  public startReportingFrameRate() {
    this.stateManager.updateState({ enabled: true, frameReport: null });
    const onFrameReport = (report: FrameRateReport) => {
      this.stateManager.updateState({ frameReport: report });
    };
    this.device.startReportingFrameRate(onFrameReport);
  }

  public stopReportingFrameRate() {
    this.stateManager.updateState({ enabled: false, frameReport: null });
    this.device.stopReportingFrameRate();
  }

  public dispose() {
    disposeAll(this.disposables);
  }
}
