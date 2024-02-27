import { Disposable } from "vscode";
import { Preview } from "./preview";
import { BuildResult } from "../builders/BuildManager";
import { DeviceInfo } from "../common/DeviceManager";
import { DeviceSettings } from "../common/Project";

export abstract class DeviceBase implements Disposable {
  private preview: Preview | undefined;

  abstract bootDevice(): Promise<void>;
  abstract changeSettings(settings: DeviceSettings): Promise<void>;
  abstract installApp(build: BuildResult, forceReinstall: boolean): Promise<void>;
  abstract launchApp(build: BuildResult, metroPort: number, devtoolsPort : number ): Promise<void>;
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

  public sendKey(keyCode: number, direction: "Up" | "Down") {
    this.preview?.sendKey(keyCode, direction);
  }

  async startPreview() {
    this.preview = this.makePreview();
    return this.preview.start();
  }
}
