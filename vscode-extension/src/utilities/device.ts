import { RuntimeInfo } from "../devices/IosSimulatorDevice";

export interface AndroidSystemImage {
  path: string;
  version: string;
  description: string;
  location?: string;
  apiLevel: number;
}

export enum PLATFORM {
  IOS = "iOS",
  ANDROID = "Android",
}

export type DeviceInfo =
  | {
      id: string;
      platform: PLATFORM.ANDROID;
      avdName?: string;
      name: string;
      systemImage: AndroidSystemImage;
    }
  | {
      id: string;
      platform: PLATFORM.IOS;
      udid?: string;
      name: string;
      runtime: RuntimeInfo;
    };
