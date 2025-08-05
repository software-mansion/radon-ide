import pixel9 from "../../assets/pixel_9/skin.webp";
import pixel9bezel from "../../assets/pixel_9/bezel.png";
import pixel9screen from "../../assets/pixel_9/screen.png";
import pixel9Landscape from "../../assets/pixel_9/landscape/skin.webp";
import pixel9LandscapeBezel from "../../assets/pixel_9/landscape/bezel.png";
import pixel9LandscapeScreen from "../../assets/pixel_9/landscape/screen.png";

import pixel8 from "../../assets/pixel_8/skin.webp";
import pixel8bezel from "../../assets/pixel_8/bezel.png";
import pixel8screen from "../../assets/pixel_8/screen.png";
import pixel8Landscape from "../../assets/pixel_8/landscape/skin.webp";
import pixel8LandscapeBezel from "../../assets/pixel_8/landscape/bezel.png";
import pixel8LandscapeScreen from "../../assets/pixel_8/landscape/screen.png";

import pixel7 from "../../assets/pixel_7/skin.webp";
import pixel7bezel from "../../assets/pixel_7/bezel.png";
import pixel7screen from "../../assets/pixel_7/screen.png";
import pixel7Landscape from "../../assets/pixel_7/landscape/skin.webp";
import pixel7LandscapeBezel from "../../assets/pixel_7/landscape/bezel.png";
import pixel7LandscapeScreen from "../../assets/pixel_7/landscape/screen.png";

import pixel6a from "../../assets/pixel_6a/skin.webp";
import pixel6abezel from "../../assets/pixel_6a/bezel.png";
import pixel6ascreen from "../../assets/pixel_6a/screen.png";
import pixel6aLandscape from "../../assets/pixel_6a/landscape/skin.webp";
import pixel6aLandscapeBezel from "../../assets/pixel_6a/landscape/bezel.png";
import pixel6aLandscapeScreen from "../../assets/pixel_6a/landscape/screen.png";

import iphone16pro from "../../assets/iphone_16_pro/skin.png";
import iphone16probezel from "../../assets/iphone_16_pro/bezel.png";
import iphone16proscreen from "../../assets/iphone_16_pro/screen.png";
import iphone16proLandscape from "../../assets/iphone_16_pro/landscape/skin.png";
import iphone16proLandscapeBezel from "../../assets/iphone_16_pro/landscape/bezel.png";
import iphone16proLandscapeScreen from "../../assets/iphone_16_pro/landscape/screen.png";

import iphone15pro from "../../assets/iphone_15_pro/skin.png";
import iphone15probezel from "../../assets/iphone_15_pro/bezel.png";
import iphone15proscreen from "../../assets/iphone_15_pro/screen.png";
import iphone15proLandscape from "../../assets/iphone_15_pro/landscape/skin.png";
import iphone15proLandscapeBezel from "../../assets/iphone_15_pro/landscape/bezel.png";
import iphone15proLandscapeScreen from "../../assets/iphone_15_pro/landscape/screen.png";

import iphoneSE from "../../assets/iphone_SE/skin.webp";
import iphoneSEbezel from "../../assets/iphone_SE/bezel.png";
import iphoneSEscreen from "../../assets/iphone_SE/screen.png";
import iphoneSELandscape from "../../assets/iphone_SE/landscape/skin.webp";
import iphoneSELandscapeBezel from "../../assets/iphone_SE/landscape/bezel.png";
import iphoneSELandscapeScreen from "../../assets/iphone_SE/landscape/screen.png";

import { DevicePlatform } from "../../common/State";

export type DevicePropertiesFrame = {
  type: "mask" | "skin";
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
  image: string;
  imageLandscape?: string;
};

export type DeviceProperties = {
  modelName: string;
  modelId: string;
  platform: DevicePlatform;
  screenWidth: number;
  screenHeight: number;
  screenMaskImage: string;
  landscapeScreenImage: string;
  minimumAndroidApiLevel?: number;
  bezel: DevicePropertiesFrame;
  skin: DevicePropertiesFrame;
};

// Model identifiers for new devices are sourced from 'hw.device.name'
// in config.ini for Android and 'deviceType' in device.plist for iOS.

// iOS devices names should match supportedDeviceTypes inside the runtime

export const iOSSupportedDevices: DeviceProperties[] = [
  {
    modelName: "iPhone 16 Pro",
    modelId: "com.apple.CoreSimulator.SimDeviceType.iPhone-16-Pro",
    platform: DevicePlatform.IOS,
    screenWidth: 1178,
    screenHeight: 2556,
    screenMaskImage: iphone16proscreen,
    landscapeScreenImage: iphone16proLandscapeScreen,
    bezel: {
      type: "mask" as const,
      width: 1186,
      height: 2564,
      offsetX: 4,
      offsetY: 4,
      image: iphone16probezel,
      imageLandscape: iphone16proLandscapeBezel,
    },
    skin: {
      type: "skin" as const,
      width: 1285,
      height: 2663,
      offsetX: 55,
      offsetY: 55,
      image: iphone16pro,
      imageLandscape: iphone16proLandscape,
    },
  },
  {
    modelName: "iPhone 15 Pro",
    modelId: "com.apple.CoreSimulator.SimDeviceType.iPhone-15-Pro",
    platform: DevicePlatform.IOS,
    screenWidth: 1178,
    screenHeight: 2556,
    screenMaskImage: iphone15proscreen,
    landscapeScreenImage: iphone15proLandscapeScreen,
    bezel: {
      type: "mask" as const,
      width: 1186,
      height: 2564,
      offsetX: 4,
      offsetY: 4,
      image: iphone15probezel,
      imageLandscape: iphone15proLandscapeBezel,
    },
    skin: {
      type: "skin" as const,
      width: 1285,
      height: 2663,
      offsetX: 55,
      offsetY: 55,
      image: iphone15pro,
      imageLandscape: iphone15proLandscape,
    },
  },
  {
    modelName: "iPhone SE (3rd generation)",
    modelId: "com.apple.CoreSimulator.SimDeviceType.iPhone-SE-3rd-generation",
    platform: DevicePlatform.IOS,
    screenWidth: 750,
    screenHeight: 1334,
    screenMaskImage: iphoneSEscreen,
    landscapeScreenImage: iphoneSELandscapeScreen,
    bezel: {
      type: "mask",
      width: 758,
      height: 1342,
      offsetX: 4,
      offsetY: 4,
      image: iphoneSEbezel,
      imageLandscape: iphoneSELandscapeBezel,
    },
    skin: {
      type: "skin",
      width: 874,
      height: 1780,
      offsetX: 62,
      offsetY: 222,
      image: iphoneSE,
      imageLandscape: iphoneSELandscape,
    },
  },
] as const;

export const AndroidSupportedDevices: DeviceProperties[] = [
  {
    modelName: "Google Pixel 9",
    modelId: "pixel_9",
    minimumAndroidApiLevel: 35,
    platform: DevicePlatform.Android,
    screenWidth: 1080,
    screenHeight: 2424,
    screenMaskImage: pixel9screen,
    landscapeScreenImage: pixel9LandscapeScreen,
    bezel: {
      type: "mask",
      width: 1088,
      height: 2432,
      offsetX: 4,
      offsetY: 4,
      image: pixel9bezel,
      imageLandscape: pixel9LandscapeBezel,
    },
    skin: {
      type: "skin",
      width: 1198,
      height: 2531,
      offsetX: 55,
      offsetY: 58,
      image: pixel9,
      imageLandscape: pixel9Landscape,
    },
  },
  {
    modelName: "Google Pixel 8",
    modelId: "pixel_8",
    minimumAndroidApiLevel: 34,
    platform: DevicePlatform.Android,
    screenWidth: 1080,
    screenHeight: 2400,
    screenMaskImage: pixel8screen,
    landscapeScreenImage: pixel8LandscapeScreen,
    bezel: {
      type: "mask",
      width: 1088,
      height: 2408,
      offsetX: 4,
      offsetY: 4,
      image: pixel8bezel,
      imageLandscape: pixel8LandscapeBezel,
    },
    skin: {
      type: "skin",
      width: 1187,
      height: 2513,
      offsetX: 49,
      offsetY: 55,
      image: pixel8,
      imageLandscape: pixel8Landscape,
    },
  },
  {
    modelName: "Google Pixel 7",
    modelId: "pixel_7",
    minimumAndroidApiLevel: 33,
    platform: DevicePlatform.Android,
    screenWidth: 1080,
    screenHeight: 2400,
    screenMaskImage: pixel7screen,
    landscapeScreenImage: pixel7LandscapeScreen,
    bezel: {
      type: "mask",
      width: 1088,
      height: 2408,
      offsetX: 4,
      offsetY: 4,
      image: pixel7bezel,
      imageLandscape: pixel7LandscapeBezel,
    },
    skin: {
      type: "skin",
      width: 1187,
      height: 2513,
      offsetX: 49,
      offsetY: 55,
      image: pixel7,
      imageLandscape: pixel7Landscape,
    },
  },
  {
    modelName: "Google Pixel 6a",
    modelId: "pixel_6a",
    minimumAndroidApiLevel: 32,
    platform: DevicePlatform.Android,
    screenWidth: 1080,
    screenHeight: 2400,
    screenMaskImage: pixel6ascreen,
    landscapeScreenImage: pixel6aLandscapeScreen,
    bezel: {
      type: "mask",
      width: 1088,
      height: 2408,
      offsetX: 4,
      offsetY: 4,
      image: pixel6abezel,
      imageLandscape: pixel6aLandscapeBezel,
    },
    skin: {
      type: "skin",
      width: 1187,
      height: 2513,
      offsetX: 49,
      offsetY: 55,
      image: pixel6a,
      imageLandscape: pixel6aLandscape,
    },
  },
] as const;

export function mapIdToModel(deviceId: string): string {
  let device =
    iOSSupportedDevices.find((d) => d.modelId === deviceId) ||
    AndroidSupportedDevices.find((d) => d.modelId === deviceId);

  if (device) {
    return device.modelName;
  } else {
    throw new Error("Device id not recognized");
  }
}
