import fs from "fs";
import path from "path";
import { DevicePlatform } from "../common/State";

export async function checkNativeDirectoryExists(appRoot: string, platform: DevicePlatform) {
  const directoryName = platform === DevicePlatform.Android ? "android" : "ios";
  const nativeDirectoryPath = path.join(appRoot, directoryName);
  try {
    const stat = await fs.promises.stat(nativeDirectoryPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}
