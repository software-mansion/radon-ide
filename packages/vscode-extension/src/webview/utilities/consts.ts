import pixel7 from "../../assets/pixel_7/skin.webp";
import pixel7mask from "../../assets/pixel_7/mask.png";
import pixel6a from "../../assets/pixel_6a/skin.webp";
import pixel6amask from "../../assets/pixel_6a/mask.png";
import iphone15pro from "../../assets/iphone_15_pro/skin.svg";
import iphone15promask from "../../assets/iphone_15_pro/mask.svg";
import iphoneSE from "../../assets/iphone_SE/skin.png"; 
import iphoneSEmask from "../../assets/iphone_SE/mask.png"; 
import { Platform } from "../../common/DeviceManager";

export type SupportedDeviceName = keyof typeof SupportedDevices;

export const SupportedDevices = {
  "iPhone 15 Pro": {
    platform: Platform.IOS,
    screenWidth: 1179,
    screenHeight: 2556,
    frameWidth: 1297,
    frameHeight: 2663,
    offsetX: 55,
    offsetY: 55,
    frameImage: iphone15pro,
    maskImage: iphone15promask,
  },
  "iPhone SE (3rd generation)":{
    platform: Platform.IOS,
    screenWidth: 750,
    screenHeight: 1334,
    frameWidth: 874,
    frameHeight: 1780,
    offsetX: 62,
    offsetY: 222,
    frameImage: iphoneSE,
    maskImage: iphoneSEmask,
  },
  "Google Pixel 7": {
    platform: Platform.Android,
    screenWidth: 1080,
    screenHeight: 2400,
    frameWidth: 1200,
    frameHeight: 2541,
    offsetX: 59,
    offsetY: 58,
    frameImage: pixel7,
    maskImage: pixel7mask,
  },
  "Google Pixel 6a": {
    platform: Platform.Android,
    screenWidth: 1080,
    screenHeight: 2400,
    frameWidth: 1207,
    frameHeight: 2555,
    offsetX: 57,
    offsetY: 69,
    frameImage: pixel6a,
    maskImage: pixel6amask,
  },
};

export type DeviceProperties = {
  name: string;
  platform: Platform;
  screenWidth: number;
  screenHeight: number;
  frameWidth: number;
  frameHeight: number;
  offsetX: number;
  offsetY: number;
  frameImage: string;
  maskImage: string;
};
