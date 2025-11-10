import path from "path";
import { Disposable, EventEmitter } from "vscode";
import _ from "lodash";
import {
  DeviceSettings,
  AndroidPhysicalDeviceInfo,
  DevicePlatform,
  DeviceType,
  DevicesByType,
  DeviceRotation,
} from "../common/State";
import { OutputChannelRegistry } from "../project/OutputChannelRegistry";
import { exec } from "../utilities/subprocess";
import { ADB_PATH, AndroidDevice } from "./AndroidDevice";
import { DeviceAlreadyUsedError } from "./DeviceAlreadyUsedError";
import { DevicesProvider } from "./DevicesProvider";
import { StateManager } from "../project/StateManager";
import { Logger } from "../Logger";
import { AndroidBuildResult } from "../builders/buildAndroid";
import { getAppCachesDir } from "../utilities/common";
import { Preview } from "./preview";

export class AndroidPhysicalDevice extends AndroidDevice {
  private deviceReconnectedEventEmitter = new EventEmitter<void>();
  public readonly onDeviceReconnected = this.deviceReconnectedEventEmitter.event;

  constructor(
    public readonly deviceInfo: AndroidPhysicalDeviceInfo,
    deviceSettings: DeviceSettings,
    outputChannelRegistry: OutputChannelRegistry
  ) {
    super(deviceSettings, outputChannelRegistry);
    this.serial = deviceInfo.id;
  }

  get lockFilePath(): string {
    return path.join(getAppCachesDir(), `android_device_${this.serial}.lock`);
  }

  async bootDevice(): Promise<void> {
    // NOOP
  }

  protected changeSettings(_settings: DeviceSettings): Promise<boolean> {
    return Promise.resolve(false);
  }

  public getClipboard(): Promise<string | void> {
    // TODO:
    return Promise.resolve("");
  }

  protected makePreview(licenseToken?: string): Preview {
    const args = ["android_device", "--id", this.serial!];
    if (licenseToken !== undefined) {
      args.push("-t", licenseToken);
    }
    return new Preview(args);
  }

  public override sendRotate(rotation: DeviceRotation): void {
    if (rotation === DeviceRotation.PortraitUpsideDown) {
      // NOTE: the issue here is that the screen sharing agent does not seem to distinguish between
      // an application running in PortraitUpsideDown and one running in Portrait mode while the device
      // orientation is set to PortraitUpsideDown. We rotate the stream incorrectly in one of these cases,
      // which _also_ breaks touch input.
      Logger.warn("PortraitUpsideDown rotation is not supported on physical Android devices.");
      return;
    }
    super.sendRotate(rotation);
  }

  protected override mirrorNativeLogs(_build: AndroidBuildResult): void {
    // TODO:
    return;
  }

  public notifyDeviceReconnected() {
    Logger.info(`Physical device reconnected: ${this.serial}`);
    this.deviceReconnectedEventEmitter.fire();
  }

  public async recoverConnectionAfterReconnect(metroPort: number, devtoolsPort?: number) {
    try {
      await exec(ADB_PATH, ["-s", this.serial!, "reverse", `tcp:${metroPort}`, `tcp:${metroPort}`]);
      Logger.info(`Re-established adb reverse for metro port ${metroPort}`);
      
      if (devtoolsPort !== undefined) {
        await exec(ADB_PATH, [
          "-s",
          this.serial!,
          "reverse",
          `tcp:${devtoolsPort}`,
          `tcp:${devtoolsPort}`,
        ]);
        Logger.info(`Re-established adb reverse for devtools port ${devtoolsPort}`);
      }
    } catch (error) {
      Logger.error("Failed to re-establish adb reverse", error);
      throw error;
    }
  }

  public override dispose() {
    super.dispose();
    this.deviceReconnectedEventEmitter.dispose();
  }
}

const ADB_ENTRY_REGEX = /^([a-zA-Z0-9\-]+)\s+device\s+((\w+:[\w\-]+\s?)*)$/;

async function getPhysicalScreenDimensions(
  serial: string
): Promise<{ width: number; height: number } | undefined> {
  const { stdout } = await exec(ADB_PATH, ["-s", serial, "shell", "wm", "size"]);
  const sizeRegex = /Physical size:\s*(\d+)x(\d+)/;
  const result = sizeRegex.exec(stdout);
  if (result === null || result.length < 3) {
    return undefined;
  }
  return {
    width: parseInt(result[1], 10),
    height: parseInt(result[2], 10),
  };
}

export async function listConnectedDevices(): Promise<AndroidPhysicalDeviceInfo[]> {
  const { stdout } = await exec(ADB_PATH, ["devices", "-l"]);
  const devices = (
    await Promise.all(
      stdout
        .split("\n")
        .slice(1)
        .map(async (line): Promise<AndroidPhysicalDeviceInfo | undefined> => {
          const result = ADB_ENTRY_REGEX.exec(line);
          if (result === null || result[0].startsWith("emulator-")) {
            return undefined;
          }
          const props = result[2].split(/\s+/).reduce(
            (acc, entry) => {
              const [key, value] = entry.trim().split(":");
              acc[key] = value;
              return acc;
            },
            {} as Record<string, string>
          );
          const serial = result[1];
          const screenDimensions = await getPhysicalScreenDimensions(serial);
          if (!screenDimensions) {
            return undefined;
          }
          return {
            id: serial,
            platform: DevicePlatform.Android,
            modelId: props["model"],
            systemName: "Unknown",
            displayName: `${props["device"]} ${props["model"]}`.trim(),
            deviceType: DeviceType.Phone,
            available: true,
            emulator: false,
            properties: {
              screenHeight: screenDimensions.height,
              screenWidth: screenDimensions.width,
            },
          };
        })
    )
  ).filter((device) => device !== undefined);
  return devices;
}

export class PhysicalAndroidDeviceProvider
  implements DevicesProvider<AndroidPhysicalDeviceInfo>, Disposable
{
  private disposables: Disposable[];
  private activeDevices = new Map<string, AndroidPhysicalDevice>();

  constructor(
    private stateManager: StateManager<DevicesByType>,
    private outputChannelRegistry: OutputChannelRegistry
  ) {
    const intervalId = setInterval(() => {
      this.listDevices().catch(() => {});
    }, 1000);
    this.disposables = [this.stateManager, new Disposable(() => clearInterval(intervalId))];
  }

  public async acquireDevice(
    deviceInfo: AndroidPhysicalDeviceInfo,
    deviceSettings: DeviceSettings
  ): Promise<AndroidPhysicalDevice | undefined> {
    const device = new AndroidPhysicalDevice(
      deviceInfo,
      deviceSettings,
      this.outputChannelRegistry
    );

    if (await device.acquire()) {
      this.activeDevices.set(deviceInfo.id, device);
      return device;
    }

    device.dispose();
    throw new DeviceAlreadyUsedError();
  }

  public async listDevices() {
    const devices = await listConnectedDevices();
    const previousDevices = this.stateManager.getState().androidPhysicalDevices ?? [];
    const disconnectedDevices = previousDevices
      .filter((d) => !devices.some(({ id }) => id === d.id))
      .map((d) =>
        Object.assign({}, d, {
          available: false,
        })
      );

    const reconnectedDeviceIds = devices
      .filter((d) => {
        const prevDevice = previousDevices.find((pd) => pd.id === d.id);
        return prevDevice && !prevDevice.available;
      })
      .map((d) => d.id);

    for (const deviceId of reconnectedDeviceIds) {
      const activeDevice = this.activeDevices.get(deviceId);
      if (activeDevice) {
        activeDevice.notifyDeviceReconnected();
      }
    }

    const updatedDevices = devices.concat(disconnectedDevices);
    if (!_.isEqual(updatedDevices, previousDevices)) {
      this.stateManager.updateState({
        androidPhysicalDevices: updatedDevices,
      });
    }

    return updatedDevices;
  }

  public dispose() {
    this.disposables.forEach((d) => d.dispose());
    this.activeDevices.clear();
  }
}
