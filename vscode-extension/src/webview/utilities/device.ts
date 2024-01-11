import { AndroidSystemImage, IosRuntime } from "../providers/SystemImagesProvider";

export enum PLATFORM {
  IOS = "iOS",
  ANDROID = "Android",
}

export type Device =
  | {
      id: string;
      platform: PLATFORM.ANDROID;
      name: string;
      width: number;
      height: 2556;
      systemImage?: AndroidSystemImage;
      avdName?: string;
      backgroundImage: string;
      backgroundMargins: [number, number, number, number];
      backgroundSize: [number, number];
      backgroundBorderRadius: string;
    }
  | {
      id: string;
      platform: PLATFORM.IOS;
      uuid?: string;
      name: string;
      width: number;
      height: 2556;
      runtime?: IosRuntime;
      udid?: string;
      backgroundImage: string;
      backgroundMargins: [number, number, number, number];
      backgroundSize: [number, number];
      backgroundBorderRadius: string;
    };

export const isDeviceImageInstalled = (
  device: Device | undefined,
  installedAndroidImages: AndroidSystemImage[]
) => {
  if (!device) {
    return true;
  }
  if (device.platform === PLATFORM.ANDROID) {
    if (!device.systemImage) {
      return false;
    }
    return !!installedAndroidImages.find(
      (androidImage) => androidImage.path === device.systemImage?.path
    );
  } else if (device.platform === PLATFORM.IOS) {
    if (!device.runtime) {
      return false;
    }
    // TODO: check if the present runtime is installed on host machine.
  }
  return true;
};
