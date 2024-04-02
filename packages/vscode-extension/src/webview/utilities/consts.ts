import pixel7 from "../../assets/pixel_7/skin.webp";
import pixel7mask from "../../assets/pixel_7/mask.png";
import iphone15pro from "../../assets/iphone_15_pro/skin.svg";
import iphone15promask from "../../assets/iphone_15_pro/mask.svg";

export enum SupportedIOSDevices {
  IPHONE_15_PRO = "iPhone 15 Pro",
}

export enum SupportedAndroidDevices {
  PIXEL_7 = "Google Pixel 7",
}

export const DEVICE_GRAPHICAL_PROPERTIES = {
  "iPhone 15 Pro" : {
    screenWidth: 1179,
    screenHeight: 2556,
    frameWidth: 1285,
    frameHeight: 2663,
    offsetX: 55,
    offsetY: 55,
    frameImage: iphone15pro,
    maskImage: iphone15promask,
  },
  "Google Pixel 7": {
    screenWidth: 1080,
    screenHeight: 2400,
    frameWidth: 1200,
    frameHeight: 2541,
    offsetX: 59,
    offsetY: 58,
    frameImage: pixel7,
    maskImage: pixel7mask,
  }
}
export type DeviceProperties = {
  screenWidth: number;
  screenHeight: number;
  frameWidth: number;
  frameHeight: number;
  offsetX: number;
  offsetY: number;
  frameImage: string;
  maskImage: string;
};
