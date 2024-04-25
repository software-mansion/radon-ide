import { getCpuArchitecture } from "../utilities/common";
import { ANDROID_HOME, JAVA_HOME } from "../utilities/android";
import { Logger } from "../Logger";
import { exec, lineReader } from "../utilities/subprocess";
import { CancelToken } from "./BuildManager";
import path from "path";
import fs from "fs";
import { OutputChannel, workspace } from "vscode";
import { extensionContext } from "../utilities/extensionContext";
import { BuildAndroidProgressProcessor } from "./BuildAndroidProgressProcessor";
import { getLaunchConfiguration } from "../utilities/launchConfiguration";

const BUILD_TOOLS_PATH = path.join(ANDROID_HOME, "build-tools");
const RELATIVE_APK_PATH = "app/build/outputs/apk/debug/app-debug.apk";

// Assuming users have android folder in their project's root
export const getAndroidSourceDir = (appRootFolder: string) => path.join(appRootFolder, "android");

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

function getApkPath(appRootFolder: string) {
  const androidSourceDir = getAndroidSourceDir(appRootFolder);
  return path.join(androidSourceDir, RELATIVE_APK_PATH);
}

export async function getAndroidBuildPaths(appRootFolder: string, cancelToken: CancelToken) {
  const apkPath = getApkPath(appRootFolder);
  const packageName = await extractPackageName(apkPath, cancelToken);
  return { apkPath, packageName };
}

function makeBuildTaskName(variant: string) {
  // task name is in the format of assemble<Variant> where variant is the name of the build variant
  // that starts with a capital letter
  return "assemble" + variant.charAt(0).toUpperCase() + variant.slice(1);
}

export async function buildAndroid(
  appRootFolder: string,
  forceCleanBuild: boolean,
  cancelToken: CancelToken,
  outputChannel: OutputChannel,
  progressListener: (newProgress: number) => void
) {
  const androidSourceDir = getAndroidSourceDir(appRootFolder);
  const cpuArchitecture = getCpuArchitecture();
  const buildOptions = getLaunchConfiguration();
  const gradleArgs = [
    "-x",
    "lint",
    `-PreactNativeArchitectures=${cpuArchitecture}`,
    ...(forceCleanBuild ? ["clean"] : []),
    makeBuildTaskName(buildOptions.android?.variant || "debug"),
    "--init-script", // init script is used to patch React Android project, see comments in configureReactNativeOverrides.gradle for more details
    path.join(extensionContext.extensionPath, "lib", "android", "initscript.gradle"),
  ];
  Logger.debug("Starting Android build");
  const buildProcess = cancelToken.adapt(
    exec("./gradlew", gradleArgs, {
      cwd: androidSourceDir,
      env: { ...process.env, ...buildOptions.env, JAVA_HOME, ANDROID_HOME },
      buffer: false,
    })
  );
  const buildAndroidProgressProcessor = new BuildAndroidProgressProcessor(progressListener);
  outputChannel.clear();
  lineReader(buildProcess).onLineRead((line) => {
    outputChannel.appendLine(line);
    buildAndroidProgressProcessor.processLine(line);
  });

  await buildProcess;
  Logger.debug("Android build sucessful");
  return getAndroidBuildPaths(appRootFolder, cancelToken);
}
