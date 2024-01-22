export enum Platform {
  IOS = "iOS",
  Android = "Android",
}

export type DeviceInfo =
  | {
      id: string;
      platform: Platform.Android;
      avdId: string;
      name: string;
      systemName: string;
      available: boolean;
    }
  | {
      id: string;
      platform: Platform.IOS;
      UDID: string;
      name: string;
      systemName: string;
      available: boolean;
    };

export type AndroidSystemImageInfo = {
  name: string;
  location: string;
  apiLevel: number;
};

export type IOSDeviceTypeInfo = {
  name: string;
  identifier: string;
};

export type IOSRuntimeInfo = {
  platform: "iOS" | "tvOS" | "watchOS";
  identifier: string;
  name: string;
  supportedDeviceTypes: IOSDeviceTypeInfo[];
};

export interface DeviceManagerEventMap {
  devicesChanged: DeviceInfo[];
}

export type DeviceManagerEventListener<K extends keyof DeviceManagerEventMap> = (
  event: DeviceManagerEventMap[K]
) => void;

export interface DeviceManagerInterface {
  listAllDevices(): Promise<DeviceInfo[]>;

  createAndroidDevice(
    displayName: string,
    systemImage: AndroidSystemImageInfo
  ): Promise<DeviceInfo>;
  createIOSDevice(deviceType: IOSDeviceTypeInfo, runtime: IOSRuntimeInfo): Promise<DeviceInfo>;

  removeDevice(device: DeviceInfo): Promise<void>;

  listInstalledAndroidImages(): Promise<AndroidSystemImageInfo[]>;
  listInstalledIOSRuntimes(): Promise<IOSRuntimeInfo[]>;

  addListener<K extends keyof DeviceManagerEventMap>(
    eventType: K,
    listener: DeviceManagerEventListener<K>
  ): Promise<void>;
  removeListener<K extends keyof DeviceManagerEventMap>(
    eventType: K,
    listener: DeviceManagerEventListener<K>
  ): Promise<void>;
}
