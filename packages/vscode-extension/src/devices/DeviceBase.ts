import { Disposable } from "vscode";
import { Preview } from "./preview";
import { BuildResult } from "../builders/BuildManager";
import { DeviceSettings } from "../common/Project";
import { Platform } from "../common/DeviceManager";
import { tryAcquiringLock } from "../utilities/common";

import fs from "fs";
import path from "path";

export abstract class DeviceBase implements Disposable {
  private preview: Preview | undefined;

  abstract get lockFilePath(): string;

  abstract bootDevice(): Promise<void>;
  abstract changeSettings(settings: DeviceSettings): Promise<void>;
  abstract installApp(build: BuildResult, forceReinstall: boolean): Promise<void>;
  abstract launchApp(build: BuildResult, metroPort: number, devtoolsPort: number): Promise<void>;
  abstract makePreview(): Preview;
  abstract get platform(): Platform;

  async acquire() {
    await createDirectory(path.dirname(this.lockFilePath));
    return tryAcquiringLock(this.lockFilePath);
  }

  dispose() {
    try {
      fs.unlinkSync(this.lockFilePath);
    } catch (_error) {
      // ignore ENOENT
    }
    this.preview?.dispose();
  }

  get previewURL(): string | undefined {
    return this.preview?.streamURL;
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
    this.preview = this.makePreview();
    return this.preview.start();
  }
}

async function createDirectory(filePath: string) {
  return new Promise<string | undefined>((resolve, reject) => {
    fs.mkdir(filePath, { recursive: true }, (err, path) => {
      if (err) {
        reject(err);
      }
      resolve(path);
    });
  });
}
