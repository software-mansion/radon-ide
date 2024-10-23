import path from "path";
import os from "os";
import fs from "fs";
import { Platform } from "./platform";

export const ANDROID_HOME =
  process.env.ANDROID_HOME ??
  Platform.select({
    macos: path.join(os.homedir(), "Library/Android/sdk"),
    windows: path.join(os.homedir(), "AppData\\Local\\Android\\Sdk"),
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

  const androidStudioPath = Platform.select({
    macos: "/Applications/Android Studio.app",
    windows: path.join(path.parse(os.homedir()).root, "Program Files\\Android\\Android Studio"),
  });

  const jbrPath = Platform.select({
    macos: path.join(androidStudioPath, "Contents/jbr/Contents/Home"),
    windows: path.join(androidStudioPath, "jbr"),
  });

  if (fs.existsSync(jbrPath)) {
    return jbrPath;
  }

  return Platform.select({
    macos: path.join(androidStudioPath, "Contents/jre/Contents/Home"),
    windows: path.join(androidStudioPath, "jre"),
  });
}

export const JAVA_HOME = findJavaHome();
