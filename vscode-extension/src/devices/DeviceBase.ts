import { Disposable } from "vscode";
import { Preview } from "./preview";

export interface DeviceSettings {
  appearance: "light" | "dark";
  contentSize: "xsmall" | "small" | "normal" | "large" | "xlarge" | "xxlarge" | "xxxlarge";
}

export abstract class DeviceBase implements Disposable {
  private preview: Preview | undefined;

  abstract get name(): string | undefined;
  abstract bootDevice(): Promise<void>;
  abstract changeSettings(settings: DeviceSettings): Promise<void>;
  abstract makePreview(): Preview;

  dispose() {
    this.preview?.dispose();
  }

  get previewURL(): string | undefined {
    return this.preview?.streamURL;
  }

  public sendTouch(xRatio: number, yRatio: number, type: "Up" | "Move" | "Down") {
    this.preview?.sendTouch(xRatio, yRatio, type);
  }

  async startPreview() {
    await this.bootDevice();
    this.preview = this.makePreview();
    return this.preview.start();
  }
}
