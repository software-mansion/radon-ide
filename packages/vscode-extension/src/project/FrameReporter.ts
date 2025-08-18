import { Disposable } from "vscode";
import { FramerateReport, FrameReportingState } from "../common/State";
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
        this.stopFrameRateReporting();
      })
    );

    this.disposables.push(this.stateManager);
  }

  public startFrameRateReporting() {
    this.stateManager.setState({ enabled: true, frameReport: null });
    const onFrameReport = (report: FramerateReport) => {
      this.stateManager.setState({ frameReport: report });
    };
    this.device.startFrameRateReporting(onFrameReport);
  }

  public stopFrameRateReporting() {
    this.stateManager.setState({ enabled: false, frameReport: null });
    this.device.stopFrameRateReporting();
  }

  public dispose() {
    disposeAll(this.disposables);
  }
}
