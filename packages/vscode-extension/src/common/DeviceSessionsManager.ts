import { DeviceInfo } from "./DeviceManager";

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
  reloadCurrentSession(type: ReloadAction): Promise<boolean>;
  startOrActivateSessionForDevice(
    deviceInfo: DeviceInfo,
    selectDeviceOptions?: SelectDeviceOptions
  ): Promise<void>;
}
