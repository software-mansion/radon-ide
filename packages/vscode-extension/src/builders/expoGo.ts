import fs from "fs";
import { createGunzip } from "zlib";
import path from "path";
import tar from "tar";
import { downdloadFile, getAppCachesDir } from "../utilities/common";
import { getAppRootFolder } from "../utilities/extensionContext";

const IOS_EXPO_GO_DOWNLOAD_URL = "https://dpq5q02fu5f55.cloudfront.net/Exponent-2.30.10.tar.gz";
const ANDROID_EXPO_GO_DOWNLOAD_URL = "https://d1ahtucjixef4r.cloudfront.net/Exponent-2.30.11.apk";

export function shouldUseExpoGo(): boolean {
  // TODO: Check for better solution to determine whether Expo Go should be used
  const androidExists = fs.existsSync(path.join(getAppRootFolder(), "android"));
  const iosExists = fs.existsSync(path.join(getAppRootFolder(), "ios"));
  return !(androidExists && iosExists);
}

export function getIOSExpoGoAppPath(): string {
  const iOSAppName = "Exponent-2.30.10.app";
  return path.join(getAppCachesDir(), iOSAppName);
}

export async function downloadIOSExpoGo(): Promise<string> {
  const archivePath = path.join(getAppCachesDir(), "Exponent-2.30.10.tar.gz");
  const appPath = getIOSExpoGoAppPath();
  if (!fs.existsSync(appPath)) {
    fs.mkdirSync(appPath, { recursive: true });
  }
  await downdloadFile(IOS_EXPO_GO_DOWNLOAD_URL, archivePath);
  const readStream = fs.createReadStream(archivePath);
  const extractStream = tar.x({ cwd: appPath });
  readStream.pipe(createGunzip()).pipe(extractStream);
  fs.unlinkSync(archivePath);
  return appPath;
}

export function getAndroidExpoGoApkPath(): string {
  const androidApkName = "Exponent-2.30.11.apk";
  return path.join(getAppCachesDir(), androidApkName);
}

export async function downloadAndroidExpoGo(): Promise<string> {
  const apkPath = getAndroidExpoGoApkPath();
  await downdloadFile(ANDROID_EXPO_GO_DOWNLOAD_URL, apkPath);
  return apkPath;
}
