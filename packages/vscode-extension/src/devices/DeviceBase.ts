import fs from "fs";
import { Disposable } from "vscode";
import { Preview } from "./preview";
import { BuildResult } from "../builders/BuildManager";
import { AppPermissionType, DeviceSettings, TouchPoint, DeviceButtonType } from "../common/Project";
import { DeviceInfo, DevicePlatform } from "../common/DeviceManager";
import { tryAcquiringLock } from "../utilities/common";
import { extensionContext } from "../utilities/extensionContext";
import { getTelemetryReporter } from "../utilities/telemetry";
import { getChanges } from "../utilities/diffing";

const LEFT_META_HID_CODE = 0xe3;
const RIGHT_META_HID_CODE = 0xe7;
const V_KEY_HID_CODE = 0x19;
const C_KEY_HID_CODE = 0x06;

export const REBOOT_TIMEOUT = 3000;

export const DEVICE_SETTINGS_KEY = "device_settings_v4";
export const DEVICE_SETTINGS_DEFAULT: DeviceSettings = {
  appearance: "dark",
  contentSize: "normal",
  location: {
    latitude: 50.048653,
    longitude: 19.965474,
    isDisabled: false,
  },
  hasEnrolledBiometrics: false,
  locale: "en_US",
  replaysEnabled: false,
  showTouches: false,
};

export abstract class DeviceBase implements Disposable {
  protected preview: Preview | undefined;
  private previewStartPromise: Promise<string> | undefined;
  private acquired = false;
  private pressingLeftMetaKey = false;
  private pressingRightMetaKey = false;
  protected deviceSettings: DeviceSettings = extensionContext.workspaceState.get(
    DEVICE_SETTINGS_KEY,
    DEVICE_SETTINGS_DEFAULT
  );

  abstract get lockFilePath(): string;

  public get previewURL() {
    return this.preview?.streamURL;
  }

  public get previewReady() {
    return this.preview?.streamURL !== undefined;
  }

  async reboot(): Promise<void> {
    this.preview?.dispose();
    this.preview = undefined;
    this.previewStartPromise = undefined;
  }

  async updateDeviceSettings(settings: DeviceSettings) {
    const changes = getChanges(this.deviceSettings, settings);

    getTelemetryReporter().sendTelemetryEvent("device-settings:update-device-settings", {
      platform: this.platform,
      changedSetting: JSON.stringify(changes),
    });

    extensionContext.workspaceState.update(DEVICE_SETTINGS_KEY, settings);
    if (this.previewReady) {
      if (changes.replaysEnabled !== undefined) {
        if (changes.replaysEnabled) {
          this.enableReplay();
        } else {
          this.disableReplays();
        }
      }
      if (changes.showTouches !== undefined) {
        if (changes.showTouches) {
          this.showTouches();
        } else {
          this.hideTouches();
        }
      }
    }

    return this.changeSettings(settings);
  }

  abstract bootDevice(): Promise<void>;
  protected abstract changeSettings(settings: DeviceSettings): Promise<boolean>;
  abstract sendBiometricAuthorization(isMatch: boolean): Promise<void>;
  abstract getClipboard(): Promise<string | void>;
  abstract installApp(build: BuildResult, forceReinstall: boolean): Promise<void>;
  abstract launchApp(build: BuildResult, metroPort: number, devtoolsPort: number): Promise<void>;
  abstract terminateApp(packageNameOrBundleID: string): Promise<void>;
  abstract makePreview(): Preview;
  abstract get platform(): DevicePlatform;
  abstract get deviceInfo(): DeviceInfo;
  abstract resetAppPermissions(
    appPermission: AppPermissionType,
    buildResult: BuildResult
  ): Promise<boolean>;
  abstract sendDeepLink(
    link: string,
    buildResult: BuildResult,
    terminateApp: boolean
  ): Promise<void>;

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

  public async captureScreenshot() {
    if (!this.preview) {
      throw new Error("Preview not started");
    }
    return this.preview.captureScreenShot();
  }

  public sendTouches(touches: Array<TouchPoint>, type: "Up" | "Move" | "Down") {
    this.preview?.sendTouches(touches, type);
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

  async startPreview() {
    if (!this.previewStartPromise) {
      this.preview = this.makePreview();
      this.previewStartPromise = this.preview.start();
      this.previewStartPromise.then(() => {
        if (this.deviceSettings.replaysEnabled) {
          this.enableReplay();
        }
        if (this.deviceSettings.showTouches) {
          this.showTouches();
        }
      });
    }
    return this.previewStartPromise;
  }
}
