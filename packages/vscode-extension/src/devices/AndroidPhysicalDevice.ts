import path from "path";
import {
  DeviceSettings,
  DeviceInfo,
  AndroidPhysicalDeviceInfo,
  DevicePlatform,
  DeviceType,
} from "../common/State";
import { OutputChannelRegistry } from "../project/OutputChannelRegistry";
import { exec } from "../utilities/subprocess";
import { ADB_PATH, AndroidDevice } from "./AndroidDevice";
import { Preview } from "./preview";
import { extensionContext } from "../utilities/extensionContext";

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
    throw new Error("Method not implemented.");
  }
  public getClipboard(): Promise<string | void> {
    throw new Error("Method not implemented.");
  }
  protected makePreview(): Preview {
    return new Preview(["android_device", "--id", this.serial!]);
  }
}

const ADB_ENTRY_REGEX = /^([a-z0-9\-]+)\s+device\s+((\w+:[\w\-]+\s?)*)$/;

export async function listConnectedDevices(): Promise<DeviceInfo[]> {
  const { stdout } = await exec(ADB_PATH, ["devices", "-l"]);
  const devices = stdout
    .split("\n")
    .slice(1)
    .map((line): AndroidPhysicalDeviceInfo | undefined => {
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
      return {
        id: result[1],
        platform: DevicePlatform.Android,
        modelId: props["model"],
        systemName: "Unknown",
        displayName: `${props["device"]} ${props["model"]}`.trim(),
        deviceType: DeviceType.Phone,
        available: true,
        emulator: false,
      };
    })
    .filter((device) => device !== undefined);
  return devices;
}
