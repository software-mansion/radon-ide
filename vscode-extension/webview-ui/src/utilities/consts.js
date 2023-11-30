import iphone14 from "../../assets/iphone14.png";
import pixel7 from "../../assets/pixel7.png";

export const DEVICES = [
    {
        id: "ios-17-iphone-15pro",
        platform: "iOS",
        name: "iPhone 15 Pro – iOS 17",
        width: 1179,
        height: 2556,
        backgroundImage: iphone14,
        backgroundMargins: [29, 33, 30, 36],
        backgroundSize: [1232, 608],
        backgroundBorderRadius: "12% / 6%",
    },
    {
        id: "android-33-pixel-7",
        platform: "Android",
        name: "Pixel 7 – Android 13",
        width: 412,
        height: 869,
        backgroundImage: pixel7,
        backgroundMargins: [58, 62, 62, 58],
        backgroundSize: [2541, 1200],
        backgroundBorderRadius: "4% / 2%",
    },
];

export const XCODE_DOWNLOAD_URL = "https://developer.apple.com/xcode/resources";
export const ANDROID_STUDIO_DOWNLOAD_URL = "https://developer.android.com/studio";
  