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
        this.stopReportingFrameRate();
      })
    );

    this.disposables.push(this.stateManager);
  }

  public startReportingFrameRate() {
    this.stateManager.setState({ enabled: true, frameReport: null });
    const onFrameReport = (report: FrameRateReport) => {
      this.stateManager.setState({ frameReport: report });
    };
    this.device.startReportingFrameRate(onFrameReport);
  }

  public stopReportingFrameRate() {
    this.stateManager.setState({ enabled: false, frameReport: null });
    this.device.stopReportingFrameRate();
  }

  public dispose() {
    disposeAll(this.disposables);
  }
}
