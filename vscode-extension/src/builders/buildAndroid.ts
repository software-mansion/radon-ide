import loadConfig from "@react-native-community/cli-config";
import { ANDROID_FAIL_ERROR_MESSAGE, getCpuArchitecture } from "../utilities/common";
import { ANDROID_HOME } from "../utilities/android";
import { Logger } from "../Logger";
import { execaWithLog } from "../utilities/subprocess";

const path = require("path");

const AAPT_PATH = path.join(ANDROID_HOME, "build-tools", "33.0.0", "aapt");

async function build(projectDir: string, gradleArgs: string[]) {
  try {
    await execaWithLog("./gradlew", gradleArgs, {
      cwd: projectDir,
    });
  } catch (error) {
    throw new Error(`${ANDROID_FAIL_ERROR_MESSAGE}, ${error}`);
  }
}

async function extractPackageName(artifactPath: string) {
  const { stdout } = await execaWithLog(AAPT_PATH, ["dump", "badging", artifactPath]);
  const packageLine = stdout.split("\n").find((line: string) => line.startsWith("package: name="));
  const packageName = packageLine!.split("'")[1];
  return packageName;
}

export async function buildAndroid(workspaceDir: string) {
  const ctx = loadConfig(workspaceDir);
  const androidSourceDir = ctx.project.android!.sourceDir;
  const cpuArchitecture = getCpuArchitecture();
  const gradleArgs = [
    "-x",
    "lint",
    `-PreactNativeArchitectures=${cpuArchitecture}`,
    `assembleDebug`,
  ];
  await build(androidSourceDir, gradleArgs);
  Logger.log("Android build sucessful");
  const apkPath = path.join(androidSourceDir, "app/build/outputs/apk/debug/app-debug.apk");
  const packageName = await extractPackageName(apkPath);
  return { apkPath, packageName };
}
