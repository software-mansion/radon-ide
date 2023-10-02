import { Preview } from "./preview";

export abstract class DeviceBase {
  private preview: Preview | undefined;

  abstract get name(): string | undefined;
  abstract bootDevice(): Promise<void>;
  abstract makePreview(): Preview;

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
