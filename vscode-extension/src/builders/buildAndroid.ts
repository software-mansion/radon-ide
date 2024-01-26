import { ANDROID_FAIL_ERROR_MESSAGE, getCpuArchitecture } from "../utilities/common";
import { ANDROID_HOME, JAVA_HOME } from "../utilities/android";
import { Logger } from "../Logger";
import { exec } from "../utilities/subprocess";

const path = require("path");

const AAPT_PATH = path.join(ANDROID_HOME, "build-tools", "33.0.0", "aapt");
const RELATIVE_APK_PATH = "app/build/outputs/apk/debug/app-debug.apk";

// Assuming users have android folder in their project's root
export const getAndroidSourceDir = (workspace: string) => `${workspace}/android`;

async function build(projectDir: string, gradleArgs: string[]) {
  try {
    await exec("./gradlew", gradleArgs, {
      cwd: projectDir,
      env: { ...process.env, JAVA_HOME },
    });
  } catch (error) {
    throw new Error(`${ANDROID_FAIL_ERROR_MESSAGE}, ${error}`);
  }
}

async function extractPackageName(artifactPath: string) {
  const { stdout } = await exec(AAPT_PATH, ["dump", "badging", artifactPath]);
  const packageLine = stdout.split("\n").find((line: string) => line.startsWith("package: name="));
  const packageName = packageLine!.split("'")[1];
  return packageName;
}

function getApkPath(workspaceDir: string) {
  const androidSourceDir = getAndroidSourceDir(workspaceDir);
  return path.join(androidSourceDir, RELATIVE_APK_PATH);
}

export async function getAndroidBuildPaths(workspaceDir: string) {
  const apkPath = getApkPath(workspaceDir);
  const packageName = await extractPackageName(apkPath);
  return { apkPath, packageName };
}

export async function buildAndroid(workspaceDir: string) {
  const androidSourceDir = getAndroidSourceDir(workspaceDir);
  const cpuArchitecture = getCpuArchitecture();
  const gradleArgs = [
    "-x",
    "lint",
    `-PreactNativeArchitectures=${cpuArchitecture}`,
    `assembleDebug`,
  ];
  await build(androidSourceDir, gradleArgs);
  Logger.debug("Android build sucessful");
  return getAndroidBuildPaths(workspaceDir);
}
