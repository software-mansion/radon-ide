import { DeviceInfo, DeviceSettings } from "../common/State";
import { DeviceBase } from "./DeviceBase";

export interface DevicesProvider<T extends DeviceInfo = DeviceInfo> {
  listDevices(): Promise<T[]>;
  acquireDevice(
    deviceInfo: DeviceInfo,
    deviceSettings: DeviceSettings
  ): Promise<DeviceBase | undefined>;
}
