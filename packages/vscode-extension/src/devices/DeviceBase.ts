import { Disposable } from "vscode";
import { Preview } from "./preview";
import { BuildResult } from "../builders/BuildManager";
import { AppPermissionType, DeviceSettings } from "../common/Project";
import { DeviceInfo, DevicePlatform } from "../common/DeviceManager";
import { tryAcquiringLock } from "../utilities/common";

import fs from "fs";
import { storeDeviceSettings } from "../project/persistentStorage";

export abstract class DeviceBase implements Disposable {
  private preview: Preview | undefined;
  private previewStartPromise: Promise<string> | undefined;
  private acquired = false;

  abstract get lockFilePath(): string;

  abstract bootDevice(): Promise<void>;
  abstract installApp(build: BuildResult, forceReinstall: boolean): Promise<void>;
  abstract launchApp(build: BuildResult, metroPort: number, devtoolsPort: number): Promise<void>;
  abstract makePreview(): Preview;
  abstract get platform(): DevicePlatform;
  abstract resetAppPermissions(
    appPermission: AppPermissionType,
    buildResult: BuildResult
  ): Promise<boolean>;

  constructor(public readonly deviceInfo: DeviceInfo, public readonly settings: DeviceSettings) {}

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

  public async changeSettings(settings: DeviceSettings): Promise<void> {
    await storeDeviceSettings(this.deviceInfo.id, settings);
  }

  public sendTouch(xRatio: number, yRatio: number, type: "Up" | "Move" | "Down") {
    this.preview?.sendTouch(xRatio, yRatio, type);
  }

  public sendKey(keyCode: number, direction: "Up" | "Down") {
    this.preview?.sendKey(keyCode, direction);
  }

  public sendPaste(text: string) {
    this.preview?.sendPaste(text);
  }

  async startPreview() {
    if (!this.previewStartPromise) {
      this.preview = this.makePreview();
      this.previewStartPromise = this.preview.start();
    }
    return this.previewStartPromise;
  }
}
