import fs from "fs";
import { Disposable } from "vscode";
import { Preview } from "./preview";
import { BuildResult } from "../builders/BuildManager";
import { AppPermissionType, DeviceSettings, TouchPoint } from "../common/Project";
import { DeviceInfo, DevicePlatform } from "../common/DeviceManager";
import { tryAcquiringLock } from "../utilities/common";
import { Logger } from "../Logger";

export abstract class DeviceBase implements Disposable {
  protected preview: Preview | undefined;
  private previewStartPromise: Promise<string> | undefined;
  private acquired = false;

  abstract get lockFilePath(): string;

  abstract bootDevice(deviceSettings: DeviceSettings): Promise<void>;
  abstract changeSettings(settings: DeviceSettings): Promise<boolean>;
  abstract sendBiometricAuthorization(isMatch: boolean): Promise<void>;
  abstract installApp(build: BuildResult, forceReinstall: boolean): Promise<void>;
  abstract launchApp(build: BuildResult, metroPort: number, devtoolsPort: number): Promise<void>;
  abstract makePreview(): Preview;
  abstract get platform(): DevicePlatform;
  abstract get deviceInfo(): DeviceInfo;
  abstract resetAppPermissions(
    appPermission: AppPermissionType,
    buildResult: BuildResult
  ): Promise<boolean>;
  abstract sendDeepLink(link: string, buildResult: BuildResult): Promise<void>;

  async acquire() {
    const acquired = await tryAcquiringLock(this.lockFilePath);
    this.acquired = acquired;
    return acquired;
  }

  dispose() {
    if (this.acquired) {
      try {
        fs.unlinkSync(this.lockFilePath);
      } catch (_error) {
        // ignore ENOENT
      }
    }
    this.preview?.dispose();
  }

  public showTouches() {
    return this.preview?.showTouches();
  }

  public hideTouches() {
    return this.preview?.hideTouches();
  }

  public startRecording() {
    if (!this.preview) {
      throw new Error("Preview not started");
    }
    return this.preview.startRecording();
  }

  public async captureAndStopRecording() {
    if (!this.preview) {
      throw new Error("Preview not started");
    }
    return this.preview.captureAndStopRecording();
  }

  public enableReplay() {
    if (!this.preview) {
      throw new Error("Preview not started");
    }
    return this.preview.startReplays();
  }

  public disableReplays() {
    return this.preview?.stopReplays();
  }

  public async captureReplay() {
    if (!this.preview) {
      throw new Error("Preview not started");
    }
    return this.preview.captureReplay();
  }

  public sendTouches(touches: Array<TouchPoint>, type: "Up" | "Move" | "Down") {
    this.preview?.sendTouches(touches, type);
  }

  public sendKey(keyCode: number, direction: "Up" | "Down") {
    this.preview?.sendKey(keyCode, direction);
  }

  public async sendPaste(text: string) {
    return this.preview?.sendPaste(text);
  }

  public async checkLicense(token: string) {
    return this.preview?.checkLicense(token);
  }

  async startPreview() {
    if (!this.previewStartPromise) {
      this.preview = this.makePreview();
      this.previewStartPromise = this.preview.start();
    }
    return this.previewStartPromise;
  }
}
