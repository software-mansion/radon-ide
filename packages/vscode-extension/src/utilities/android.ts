import path from "path";
import os from "os";
import fs from "fs";

export const ANDROID_HOME =
  process.env.ANDROID_HOME || process.platform === "win32"
    ? path.join(os.homedir(), "AppData/Local/Android/Sdk")
    : path.join(os.homedir(), "Library/Android/sdk");

const ANDROID_STUDIO_PATH =
  process.platform === "win32"
    ? "C:\\Program Files\\Android\\Android Studio"
    : "/Applications/Android Studio.app";

function findJavaHome() {
  // we try to use java bundled with Android Studio if exists
  // in newer distributions java is placed under Contents/jbr/Contents/Home and with some
  // older (but still recent ones) it is under Contents/jre/Contents/Home
  // we check if the first path exists and if not we try the second one

  const jbrPath =
    process.platform === "win32"
      ? path.join(ANDROID_STUDIO_PATH, "jbr")
      : path.join(ANDROID_STUDIO_PATH, "Contents/jbr/Contents/Home");

  const jrePath =
    process.platform === "win32"
      ? path.join(ANDROID_STUDIO_PATH, "jre")
      : path.join(ANDROID_STUDIO_PATH, "Contents/jre/Contents/Home");

  if (fs.existsSync(jbrPath)) {
    return jbrPath;
  }

  if (fs.existsSync(jrePath)) {
    return jrePath;
  }
  return process.env.JAVA_HOME;
}

export const JAVA_HOME = findJavaHome();
