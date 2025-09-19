import path from "path";
import fs from "fs";
import os from "os";
import { Disposable, window } from "vscode";
import { FileTransferState } from "../common/State";
import { Logger } from "../Logger";
import { getTelemetryReporter } from "../utilities/telemetry";
import { StateManager } from "./StateManager";
import { DeviceBase } from "../devices/DeviceBase";

export class FileTransfer implements Disposable {
  constructor(
    private readonly stateManager: StateManager<FileTransferState>,
    private readonly device: DeviceBase
  ) {}

  dispose() {
    this.stateManager.dispose();
    if (this.tempDir) {
      fs.promises.rm(this.tempDir, { recursive: true }).catch((_e) => {
        /* silence the errors, it's fine */
      });
    }
  }

  public async sendFile(filePath: string) {
    getTelemetryReporter().sendTelemetryEvent("device:send-file", {
      platform: this.device.deviceInfo.platform,
      extension: path.extname(filePath),
    });

    const fileName = path.basename(filePath);

    const sendingFiles = [...this.stateManager.getState().sendingFiles, fileName];
    this.stateManager.updateState({ sendingFiles });
    try {
      const result = await this.device.sendFile(filePath);
      const newSentFiles = [...this.stateManager.getState().sentFiles, fileName];
      this.stateManager.updateState({ sentFiles: newSentFiles });
      return result;
    } catch (e) {
      const newErrors = [
        ...this.stateManager.getState().erroredFiles,
        {
          fileName,
          errorMessage: (e as Error).message,
        },
      ];
      this.stateManager.updateState({ erroredFiles: newErrors });
      throw e;
    } finally {
      this.removeFileFromState(fileName);
    }
  }

  private removeFileFromState(fileName: string) {
    const sendingFiles = this.stateManager.getState().sendingFiles;
    const fileIndex = sendingFiles.indexOf(fileName);
    if (fileIndex === -1) {
      Logger.debug("Inconsistent `sendingFiles` state, expected file not found.", fileName);
      return;
    }
    const withoutFile = [...sendingFiles];
    withoutFile.splice(fileIndex, 1);
    this.stateManager.updateState({ sendingFiles: withoutFile });
  }

  public async openSendFileDialog() {
    const pickerResult = await window.showOpenDialog({
      canSelectMany: true,
      canSelectFolders: false,
      title: "Select files to send to device",
    });
    if (!pickerResult) {
      throw new Error("No files selected");
    }
    const sendFilePromises = pickerResult.map((fileUri) => {
      return this.sendFile(fileUri.fsPath);
    });
    await Promise.all(sendFilePromises);
  }

  public async sendFileToDevice(fileName: string, data: ArrayBuffer): Promise<void> {
    let canSafelyRemove = true;
    const tempDir = await this.getTemporaryFilesDirectory();
    const tempFileLocation = path.join(tempDir, fileName);
    try {
      await fs.promises.writeFile(tempFileLocation, new Uint8Array(data));
      const result = await this.sendFile(tempFileLocation);
      canSafelyRemove = result.canSafelyRemove;
    } finally {
      if (canSafelyRemove) {
        // NOTE: no need to await this, it can run in the background
        fs.promises.rm(tempFileLocation, { force: true }).catch((_e) => {
          // NOTE: we can ignore errors here, as the file might not exist
        });
      }
    }
  }

  private tempDir: string | undefined;
  /**
   * Returns the path to a temporary directory, creating it if it does not already exist.
   * The directory is created using the system's temporary directory and is cleaned up
   * automatically when the device session is disposed. Subsequent calls return the same directory path.
   *
   * @returns {Promise<string>} The path to the temporary directory.
   */
  private async getTemporaryFilesDirectory(): Promise<string> {
    if (this.tempDir === undefined) {
      const tempDir = await fs.promises.mkdtemp(os.tmpdir());
      this.tempDir = tempDir;
    }
    return this.tempDir;
  }
}
