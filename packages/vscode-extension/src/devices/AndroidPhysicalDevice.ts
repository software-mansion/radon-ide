import path from "path";
import {
  DeviceSettings,
  AndroidPhysicalDeviceInfo,
  DevicePlatform,
  DeviceType,
} from "../common/State";
import { OutputChannelRegistry } from "../project/OutputChannelRegistry";
import { exec } from "../utilities/subprocess";
import { ADB_PATH, AndroidDevice } from "./AndroidDevice";
import { Preview } from "./preview";
import { extensionContext } from "../utilities/extensionContext";
import { DeviceAlreadyUsedError } from "./DeviceAlreadyUsedError";
import { DevicesProvider } from "./DevicesProvider";

export class AndroidPhysicalDevice extends AndroidDevice {
  constructor(
    public readonly deviceInfo: AndroidPhysicalDeviceInfo,
    deviceSettings: DeviceSettings,
    outputChannelRegistry: OutputChannelRegistry
  ) {
    super(deviceSettings, outputChannelRegistry);
    this.serial = deviceInfo.id;
  }

  get lockFilePath(): string {
    return path.join(extensionContext.extensionPath, `android_device_${this.serial}.lock`);
  }
  async bootDevice(): Promise<void> {
    // NOOP
  }
  protected changeSettings(settings: DeviceSettings): Promise<boolean> {
    // throw new Error("Method not implemented.");
    return Promise.resolve(false);
  }
  public getClipboard(): Promise<string | void> {
    // throw new Error("Method not implemented.");
    return Promise.resolve("");
  }
  protected makePreview(): Preview {
    return new Preview(["android_device", "--id", this.serial!]);
  }
}

const ADB_ENTRY_REGEX = /^([a-zA-Z0-9\-]+)\s+device\s+((\w+:[\w\-]+\s?)*)$/;

async function getPhysicalSize(
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
          const physicalSize = await getPhysicalSize(result[1]);
          if (!physicalSize) {
            return undefined;
          }
          return {
            id: result[1],
            platform: DevicePlatform.Android,
            modelId: props["model"],
            systemName: "Unknown",
            displayName: `${props["device"]} ${props["model"]}`.trim(),
            deviceType: DeviceType.Phone,
            available: true,
            emulator: false,
            properties: {
              screenHeight: physicalSize.height,
              screenWidth: physicalSize.width,
            },
          };
        })
    )
  ).filter((device) => device !== undefined);
  return devices;
}

export class PhysicalAndroidDeviceProvider implements DevicesProvider<AndroidPhysicalDeviceInfo> {
  constructor(private outputChannelRegistry: OutputChannelRegistry) {}

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
      return device;
    }

    device.dispose();
    throw new DeviceAlreadyUsedError();
  }

  public listDevices() {
    return listConnectedDevices();
  }
}
