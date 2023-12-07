import path from "path";
import os from "os";

export const ANDROID_HOME =
  process.env.ANDROID_HOME || path.join(os.homedir(), "Library/Android/sdk");
export const PREFFERED_SYSTEM_IMAGE = "android-33";
