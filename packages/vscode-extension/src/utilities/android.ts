import path from "path";
import os from "os";
import fs from "fs";
import { Platform } from "./platform";

export const ANDROID_HOME =
  process.env.ANDROID_HOME ??
  Platform.select({
    macos: path.join(os.homedir(), "Library/Android/sdk"),
    windows: path.join(os.homedir(), "AppData", "Local", "Android", "Sdk"),
  });

const ANDROID_STUDIO_PATH = Platform.select({
  macos: "/Applications/Android Studio.app",
  windows: path.join("C:", "Program Files", "Android", "Android Studio"),
});

function findJavaHome() {
  // we first try to use environment variable and if it is not set, we then use java bundled with Android Studio
  // if exists in newer distributions java is placed under Contents/jbr/Contents/Home and with some
  // older (but still recent ones) it is under Contents/jre/Contents/Home we check if the first path
  // exists and if not we try the second one

  const envJavaHome = process.env.JAVA_HOME;
  if (envJavaHome && fs.existsSync(envJavaHome)) {
    return envJavaHome;
  }

  const jbrPath = Platform.select({
    macos: path.join(ANDROID_STUDIO_PATH, "Contents/jbr/Contents/Home"),
    windows: path.join(ANDROID_STUDIO_PATH, "jbr"),
  });

  const jrePath = Platform.select({
    macos: path.join(ANDROID_STUDIO_PATH, "Contents/jre/Contents/Home"),
    windows: path.join(ANDROID_STUDIO_PATH, "jre"),
  });

  return fs.existsSync(jbrPath) ? jbrPath : jrePath;
}

export const JAVA_HOME = findJavaHome();
