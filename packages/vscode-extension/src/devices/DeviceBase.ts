import fs from "fs";
import { Disposable, EventEmitter } from "vscode";
import { Preview, PreviewError } from "./preview";
import { BuildResult } from "../builders/BuildManager";
import { AppPermissionType, TouchPoint, DeviceButtonType } from "../common/Project";
import { tryAcquiringLock } from "../utilities/common";
import {
  DeviceInfo,
  DevicePlatform,
  DeviceRotation,
  DeviceSettings,
  FrameRateReport,
} from "../common/State";

const LEFT_META_HID_CODE = 0xe3;
const RIGHT_META_HID_CODE = 0xe7;
const V_KEY_HID_CODE = 0x19;
const C_KEY_HID_CODE = 0x06;

export const REBOOT_TIMEOUT = 3000;

export abstract class DeviceBase implements Disposable {
  protected preview: Preview | undefined;
  private previewStartPromise: Promise<string> | undefined;
  private acquired = false;
  private pressingLeftMetaKey = false;
  private pressingRightMetaKey = false;
  private _rotation: DeviceRotation = DeviceRotation.Portrait;

  private previewClosedEventEmitter = new EventEmitter<PreviewError | void>();

  public readonly onPreviewClosed = this.previewClosedEventEmitter.event;

  constructor(protected deviceSettings: DeviceSettings) {}

  abstract get lockFilePath(): string;

  public get previewURL() {
    return this.preview?.streamURL;
  }

  public get previewReady() {
    return this.preview?.streamURL !== undefined;
  }

  public get rotation() {
    return this._rotation;
  }

  async reboot(): Promise<void> {
    this.preview?.dispose();
    this.preview = undefined;
    this.previewStartPromise = undefined;
  }

  async updateDeviceSettings(settings: DeviceSettings) {
    this.deviceSettings = settings;
    this.applyPreviewSettings();

    return this.changeSettings(settings);
  }

  private applyPreviewSettings() {
    const preview = this.preview;
    if (preview && preview.streamURL) {
      if (this.deviceSettings.replaysEnabled) {
        preview.startReplays();
      } else {
        preview.stopReplays();
      }
      if (this.deviceSettings.showTouches) {
        preview.showTouches();
      } else {
        preview.hideTouches();
      }
      this.sendRotate(this._rotation);
    }
  }

  abstract setUpKeyboard(): void;
  abstract bootDevice(): Promise<void>;
  protected abstract changeSettings(settings: DeviceSettings): Promise<boolean>;
  abstract sendBiometricAuthorization(isMatch: boolean): Promise<void>;
  abstract getClipboard(): Promise<string | void>;
  abstract installApp(build: BuildResult, forceReinstall: boolean): Promise<void>;
  abstract launchApp(
    build: BuildResult,
    metroPort: number,
    devtoolsPort: number | undefined,
    launchArguments: string[],
    appRoot: string
  ): Promise<void>;
  abstract terminateApp(packageNameOrBundleID: string): Promise<void>;
  protected abstract makePreview(licenseToken?: string): Preview;

  /**
   * @returns whether the file can be safely removed after the operation finished.
   */
  abstract sendFile(filePath: string): Promise<{ canSafelyRemove: boolean }>;
  abstract get platform(): DevicePlatform;
  abstract get deviceInfo(): DeviceInfo;
  abstract get id(): string;
  abstract resetAppPermissions(
    appPermission: AppPermissionType,
    buildResult: BuildResult
  ): Promise<boolean>;
  abstract sendDeepLink(
    link: string,
    buildResult: BuildResult,
    terminateApp: boolean
  ): Promise<void>;
  abstract forwardDevicePort(port: number): Promise<void>;

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
    this.previewClosedEventEmitter.dispose();
  }

  public startReportingFrameRate(onFpsReport: (report: FrameRateReport) => void) {
    this.preview?.startReportingFrameRate(onFpsReport);
  }

  public stopReportingFrameRate() {
    this.preview?.stopReportingFrameRate();
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

  public async captureAndStopRecording(rotation: DeviceRotation) {
    if (!this.preview) {
      throw new Error("Preview not started");
    }
    return this.preview.captureAndStopRecording(rotation);
  }

  public async captureReplay(rotation: DeviceRotation) {
    if (!this.preview) {
      throw new Error("Preview not started");
    }
    return this.preview.captureReplay(rotation);
  }

  public async captureScreenshot(rotation: DeviceRotation) {
    if (!this.preview) {
      throw new Error("Preview not started");
    }
    return this.preview.captureScreenShot(rotation);
  }

  public sendTouches(
    touches: Array<TouchPoint>,
    type: "Up" | "Move" | "Down",
    rotation: DeviceRotation
  ) {
    this.preview?.sendTouches(touches, type, rotation);
  }

  public sendKey(keyCode: number, direction: "Up" | "Down") {
    // iOS simulator has a buggy behavior when sending cmd+V key combination.
    // It sometimes triggers paste action but with a very low success rate.
    // Other times it kicks in before the pasteboard is filled with the content
    // therefore pasting the previously copied content instead.
    // As a temporary workaround, we disable sending cmd+V as key combination
    // entirely to prevent this buggy behavior. Users can still paste content
    // using the context menu method as they'd do on an iOS device.
    // This is not an ideal workaround as people may still trigger cmd+v by
    // pressing V first and then cmd, but it is good enough to filter out
    // the majority of the noisy behavior since typically you press cmd first.
    // Similarly, when pasting into Android Emulator, cmd+V has results in a
    // side effect of typing the letter "v" into the text field (the same
    // applies to cmd+C).
    if (keyCode === LEFT_META_HID_CODE) {
      this.pressingLeftMetaKey = direction === "Down";
    } else if (keyCode === RIGHT_META_HID_CODE) {
      this.pressingRightMetaKey = direction === "Down";
    }

    if (
      (this.pressingLeftMetaKey || this.pressingRightMetaKey) &&
      (keyCode === C_KEY_HID_CODE || keyCode === V_KEY_HID_CODE)
    ) {
      // ignore sending C and V when meta key is pressed
    } else {
      this.preview?.sendKey(keyCode, direction);
    }
  }

  public sendButton(button: DeviceButtonType, direction: "Up" | "Down") {
    this.preview?.sendButton(button, direction);
  }

  public async sendClipboard(text: string) {
    return this.preview?.sendClipboard(text);
  }

  public sendWheel(point: TouchPoint, deltaX: number, deltaY: number) {
    this.preview?.sendWheel(point, deltaX, deltaY);
  }

  public sendRotate(rotation: DeviceRotation) {
    this._rotation = rotation;
    this.preview?.rotateDevice(rotation);
  }

  private previewClosedListener = (error: PreviewError | void) => {
    this.previewStartPromise = undefined;
    this.preview?.dispose();
    this.preview = undefined;
    this.previewClosedEventEmitter.fire(error);
  };

  public async startPreview(licenseToken?: string) {
    if (!this.previewStartPromise) {
      this.preview = this.makePreview(licenseToken);
      this.preview.onClosed(this.previewClosedListener);
      this.previewStartPromise = this.preview.start();
      this.previewStartPromise.then(() => {
        this.applyPreviewSettings();
      });
    }
    return this.previewStartPromise;
  }
}
