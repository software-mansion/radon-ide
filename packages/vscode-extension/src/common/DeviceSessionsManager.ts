import { Disposable } from "vscode";
import { DeviceSessionDelegate } from "../project/deviceSession";
import { DeviceInfo } from "./DeviceManager";

export type DeviceSessionsManagerDelegate = DeviceSessionDelegate & {
  onDeviceSelected: (deviceInfo: DeviceInfo, previewURL?: string) => void;
  onReloadRequested: (type: ReloadAction) => void;
};

export type SelectDeviceOptions = {
  preservePreviousDevice?: boolean;
};

export type ReloadAction =
  | "autoReload" // automatic reload mode
  | "clearMetro" // clear metro cache, boot device, install app
  | "rebuild" // clean build, boot device, install app
  | "reboot" // reboots device, launch app
  | "reinstall" // force reinstall app
  | "restartProcess" // relaunch app
  | "reloadJs"; // refetch JS scripts from metro

export interface DeviceSessionsManagerInterface {
  reload(type: ReloadAction): Promise<boolean>;
  stopDevice(deviceId: string): Promise<boolean>;
  selectDevice(deviceInfo: DeviceInfo, selectDeviceOptions?: SelectDeviceOptions): Promise<boolean>;
}
