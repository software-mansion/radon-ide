import { Disposable } from "vscode";
import { MultimediaData, MultimediaState } from "../common/State";
import { ApplicationContext } from "./ApplicationContext";
import { StateManager } from "./StateManager";
import { DeviceBase } from "../devices/DeviceBase";
import { disposeAll } from "../utilities/disposables";
import { saveMultimedia } from "../utilities/saveMultimedia";

const MAX_RECORDING_TIME_SEC = 10 * 60; // 10 minutes

export class Multimedia implements Disposable {
  private disposables: Disposable[] = [];
  private recordingTimeout: NodeJS.Timeout | undefined = undefined;
  private recordingTimer: NodeJS.Timeout | undefined = undefined;

  constructor(
    private stateManager: StateManager<MultimediaState>,
    private device: DeviceBase,
    private applicationContext: ApplicationContext
  ) {
    this.disposables.push(
      new Disposable(() => {
        this.stopRecording();
      })
    );

    this.disposables.push(this.stateManager);
  }

  public startRecording(): void {
    this.stateManager.setState({ isRecording: true, recordingTime: 0 });

    this.device.startRecording();

    this.recordingTimer = setInterval(() => {
      const recordingTime = this.stateManager.getState().recordingTime;
      this.stateManager.setState({
        recordingTime: recordingTime + 1,
      });
    }, 1000);

    this.recordingTimeout = setTimeout(() => {
      this.stopRecording();
    }, MAX_RECORDING_TIME_SEC * 1000);
  }

  public async captureAndStopRecording() {
    const recording = await this.stopRecording();
    await this.saveMultimedia(recording);
  }

  public async toggleRecording() {
    if (this.recordingTimeout) {
      this.captureAndStopRecording();
    } else {
      this.startRecording();
    }
  }

  public async captureReplay() {
    const replayData = await this.device.captureReplay(
      this.applicationContext.workspaceConfiguration.deviceRotation
    );
    this.stateManager.setState({ replayData });
  }

  public async captureScreenshot() {
    const screenshot = await this.device.captureScreenshot(
      this.applicationContext.workspaceConfiguration.deviceRotation
    );
    await this.saveMultimedia(screenshot);
  }

  public async getScreenshot() {
    return this.device.captureScreenshot(
      this.applicationContext.workspaceConfiguration.deviceRotation
    );
  }

  private async saveMultimedia(multimediaData: MultimediaData) {
    const defaultPath =
      this.applicationContext.workspaceConfiguration.defaultMultimediaSavingLocation;
    return saveMultimedia(multimediaData, defaultPath ?? undefined);
  }

  private async stopRecording() {
    clearTimeout(this.recordingTimeout);
    clearInterval(this.recordingTimer);

    this.stateManager.setState({ isRecording: false, recordingTime: 0 });

    return this.device.captureAndStopRecording(
      this.applicationContext.workspaceConfiguration.deviceRotation
    );
  }

  public dispose() {
    disposeAll(this.disposables);
  }
}
