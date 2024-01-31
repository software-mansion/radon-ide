import pixel7 from "../../assets/pixel_7/skin.webp";
import pixel7mask from "../../assets/pixel_7/mask.png";
import iphone15pro from "../../assets/iphone_15_pro/skin.svg";
import iphone15promask from "../../assets/iphone_15_pro/mask.svg";

export const ANDROID_DEVICE_GRAPHICAL_PROPERTIES = {
  screenWidth: 1080,
  screenHeight: 2400,
  frameWidth: 1200,
  frameHeight: 2541,
  offsetX: 59,
  offsetY: 58,
  frameImage: pixel7,
  maskImage: pixel7mask,
};

export const IOS_DEVICE_GRAPHICAL_PROPERTIES = {
  screenWidth: 1179,
  screenHeight: 2556,
  frameWidth: 1285,
  frameHeight: 2663,
  offsetX: 55,
  offsetY: 55,
  frameImage: iphone15pro,
  maskImage: iphone15promask,
};

export const XCODE_DOWNLOAD_URL = "https://developer.apple.com/xcode/resources";
export const ANDROID_STUDIO_DOWNLOAD_URL = "https://developer.android.com/studio";
export const ANDROID_CMDLINE_TOOLS_DOWNLOAD_URL =
  "https://developer.android.com/studio#command-line-tools-only";
