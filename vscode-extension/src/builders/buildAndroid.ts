import { ANDROID_FAIL_ERROR_MESSAGE, getCpuArchitecture } from "../utilities/common";
import { ANDROID_HOME, JAVA_HOME } from "../utilities/android";
import { Logger } from "../Logger";
import { exec } from "../utilities/subprocess";
import { CancelToken } from "./BuildManager";

import path from "path";
import fs from "fs";

const BUILD_TOOLS_PATH = path.join(ANDROID_HOME, "build-tools");
const RELATIVE_APK_PATH = "app/build/outputs/apk/debug/app-debug.apk";

// Assuming users have android folder in their project's root
export const getAndroidSourceDir = (workspace: string) => `${workspace}/android`;

async function build(projectDir: string, gradleArgs: string[], cancelToken: CancelToken) {
  try {
    await cancelToken.adapt(
      exec("./gradlew", gradleArgs, {
        cwd: projectDir,
        env: { ...process.env, JAVA_HOME, ANDROID_HOME },
      })
    );
  } catch (error) {
    throw new Error(`${ANDROID_FAIL_ERROR_MESSAGE}, ${error}`);
  }
}

function locateAapt() {
  // search for aapt binary under BUILD_TOOLS_PATH/<version>/aapt
  // since we only need aapt to extract package name, we can use any version.
  // However, on M1 macs, aapt we noticed that older aapt versions may not work
  // as they may require rosetta, so we try to find the latest version.
  const versions = fs.readdirSync(BUILD_TOOLS_PATH);
  const latestVersion = versions.sort().reverse()[0];
  return path.join(BUILD_TOOLS_PATH, latestVersion, "aapt");
}

async function extractPackageName(artifactPath: string, cancelToken: CancelToken) {
  const aaptPath = locateAapt();
  const { stdout } = await cancelToken.adapt(exec(aaptPath, ["dump", "badging", artifactPath]));
  const packageLine = stdout.split("\n").find((line: string) => line.startsWith("package: name="));
  const packageName = packageLine!.split("'")[1];
  return packageName;
}

function getApkPath(workspaceDir: string) {
  const androidSourceDir = getAndroidSourceDir(workspaceDir);
  return path.join(androidSourceDir, RELATIVE_APK_PATH);
}

export async function getAndroidBuildPaths(workspaceDir: string, cancelToken: CancelToken) {
  const apkPath = getApkPath(workspaceDir);
  const packageName = await extractPackageName(apkPath, cancelToken);
  return { apkPath, packageName };
}

export async function buildAndroid(
  workspaceDir: string,
  forceCleanBuild: boolean,
  cancelToken: CancelToken
) {
  const androidSourceDir = getAndroidSourceDir(workspaceDir);
  const cpuArchitecture = getCpuArchitecture();
  const gradleArgs = [
    "-x",
    "lint",
    `-PreactNativeArchitectures=${cpuArchitecture}`,
    ...(forceCleanBuild ? ["clean"] : []),
    "assembleDebug",
  ];
  await build(androidSourceDir, gradleArgs, cancelToken);
  Logger.debug("Android build sucessful");
  return getAndroidBuildPaths(workspaceDir, cancelToken);
}
