import path from "path";
import os from "os";
import fs from "fs";
import { Platform } from "./platform";
import { command } from "./subprocess";

export const ANDROID_HOME =
  process.env.ANDROID_HOME ??
  Platform.select({
    macos: path.join(os.homedir(), "Library/Android/sdk"),
    windows: path.join(os.homedir(), "AppData\\Local\\Android\\Sdk"),
    linux: path.join(os.homedir(), "Android/Sdk"),
  });

export async function findJavaHome() {
  // When java is available in the PATH, we return undefined as android tooling doesn't
  // require JAVA_HOME variable to be set in that case. However, when JAVA_HOME is provided
  // it takes precedence over the java in the PATH. Finally, when JAVA_HOME is not set, and
  // java is not available in the PATH, we try to use the bundled java with Android Studio.
  // For that we check two possible locations: Contents/jbr/Contents/Home and Contents/jre/Contents/Home
  // where the first one is used in newer distributions and the second one in older ones.

  // 1) we check JAVA_HOME from the provided env object or from process.env
  const envJavaHome = process.env.JAVA_HOME;
  if (envJavaHome && fs.existsSync(envJavaHome)) {
    return envJavaHome;
  }

  // 2) we check whether java is available in the PATH
  const result = await command("java -version", {
    quietErrorsOnExit: true,
  });
  if (result.exitCode === 0) {
    return undefined;
  }

  const androidStudioPath = Platform.select({
    macos: "/Applications/Android Studio.app",
    windows: path.join(path.parse(os.homedir()).root, "Program Files\\Android\\Android Studio"),
    linux: "/usr/local/android-studio",
  });

  const jbrPath = Platform.select({
    macos: path.join(androidStudioPath, "Contents/jbr/Contents/Home"),
    windows: path.join(androidStudioPath, "jbr"),
    linux: path.join(androidStudioPath, "jbr"),
  });

  if (fs.existsSync(jbrPath)) {
    return jbrPath;
  }

  return Platform.select({
    macos: path.join(androidStudioPath, "Contents/jre/Contents/Home"),
    windows: path.join(androidStudioPath, "jre"),
    // Returning undefined as the Android Studio directory on Linux
    // might not include a jre directory, preferring jbr instead
    linux: undefined,
  });
}
