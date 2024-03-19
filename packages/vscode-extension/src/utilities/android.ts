import path from "path";
import os from "os";
import fs from "fs";

export const ANDROID_HOME =
  process.env.ANDROID_HOME || path.join(os.homedir(), "Library/Android/sdk");

const ANDROID_STUDIO_PATH = "/Applications/Android Studio.app";

function findJavaHome() {
  // we try to use java bundled with Android Studio if exists
  // in newer distributions java is placed under Contents/jbr/Contents/Home and with some
  // older (but still recent ones) it is under Contents/jre/Contents/Home
  // we check if the first path exists and if not we try the second one
  const jbrPath = path.join(ANDROID_STUDIO_PATH, "Contents/jbr/Contents/Home");
  if (fs.existsSync(jbrPath)) {
    return jbrPath;
  }
  const jrePath = path.join(ANDROID_STUDIO_PATH, "Contents/jre/Contents/Home");
  if (fs.existsSync(jrePath)) {
    return jrePath;
  }
  return process.env.JAVA_HOME;
}

export const JAVA_HOME = findJavaHome();
