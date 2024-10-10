import path from "path";
import { OutputChannel } from "vscode";
import { exec, lineReader } from "../utilities/subprocess";
import { Logger } from "../Logger";
import { CancelToken } from "./cancelToken";
import { BuildIOSProgressProcessor } from "./BuildIOSProgressProcessor";
import { getLaunchConfiguration } from "../utilities/launchConfiguration";
import { IOSDeviceInfo, DevicePlatform } from "../common/DeviceManager";
import { EXPO_GO_BUNDLE_ID, downloadExpoGo, isExpoGoProject } from "./expoGo";
import { findXcodeProject, findXcodeScheme, IOSProjectInfo } from "../utilities/xcode";
import { runExternalBuild } from "./customBuild";
import { fetchEasBuild } from "./eas";
import { getXcodebuildArch } from "../utilities/common";
import { DependencyManager } from "../dependency/DependencyManager";

export type IOSBuildResult = {
  platform: DevicePlatform.IOS;
  appPath: string;
  bundleID: string;
};

// Assuming users have ios folder in their project's root
export const getIosSourceDir = (appRootFolder: string) => path.join(appRootFolder, "ios");

async function getBundleID(appPath: string) {
  return (
    await exec("/usr/libexec/PlistBuddy", [
      "-c",
      "Print:CFBundleIdentifier",
      path.join(appPath, "Info.plist"),
    ])
  ).stdout;
}

function buildProject(
  deviceInfo: IOSDeviceInfo,
  xcodeProject: IOSProjectInfo,
  buildDir: string,
  scheme: string,
  configuration: string,
  cleanBuild: boolean
) {
  const xcodebuildArgs = [
    xcodeProject.isWorkspace ? "-workspace" : "-project",
    xcodeProject.workspaceLocation || xcodeProject.xcodeprojLocation,
    "-configuration",
    configuration,
    "-scheme",
    scheme,
    "-arch",
    getXcodebuildArch(),
    "-sdk",
    `iphonesimulator${deviceInfo.runtimeInfo.version}`,
    "-showBuildTimingSummary",
    "-destination-timeout",
    "0",
    ...(cleanBuild ? ["clean"] : []),
    "build",
  ];

  Logger.debug(`Building using "xcodebuild ${xcodebuildArgs.join(" ")}`);

  return exec("xcodebuild", xcodebuildArgs, {
    env: {
      ...getLaunchConfiguration().env,
      RCT_NO_LAUNCH_PACKAGER: "true",
    },
    cwd: buildDir,
    buffer: false,
  });
}

export async function buildIos(
  deviceInfo: IOSDeviceInfo,
  appRootFolder: string,
  forceCleanBuild: boolean,
  cancelToken: CancelToken,
  outputChannel: OutputChannel,
  progressListener: (newProgress: number) => void,
  dependencyManager: DependencyManager,
  installPodsIfNeeded: () => Promise<void>
): Promise<IOSBuildResult> {
  const { customBuild, eas, ios: buildOptions, env } = getLaunchConfiguration();

  if (customBuild?.ios && eas?.ios) {
    throw new Error(
      "Both custom builds and EAS builds are configured for iOS. Please use only one build method."
    );
  }

  if (customBuild?.ios?.buildCommand) {
    // We don't autoinstall Pods here to make custom build scripts more flexible

    const appPath = await runExternalBuild(cancelToken, customBuild.ios.buildCommand, env);
    if (!appPath) {
      throw new Error("Failed to build iOS app using custom script.");
    }

    return {
      appPath,
      bundleID: await getBundleID(appPath),
      platform: DevicePlatform.IOS,
    };
  }

  if (eas?.ios) {
    const appPath = await fetchEasBuild(cancelToken, eas.ios, DevicePlatform.IOS);
    if (!appPath) {
      throw new Error("Failed to build iOS app using EAS build.");
    }

    return {
      appPath,
      bundleID: await getBundleID(appPath),
      platform: DevicePlatform.IOS,
    };
  }

  if (await isExpoGoProject()) {
    const appPath = await downloadExpoGo(DevicePlatform.IOS, cancelToken);
    return { appPath, bundleID: EXPO_GO_BUNDLE_ID, platform: DevicePlatform.IOS };
  }

  if (!(await dependencyManager.isInstalled("ios"))) {
    throw new Error(
      "Ios directory does not exist, configure build source in launch configuration or use expo prebuild to generate the directory"
    );
  }

  const sourceDir = getIosSourceDir(appRootFolder);

  await installPodsIfNeeded();

  const xcodeProject = await findXcodeProject(appRootFolder);

  if (!xcodeProject) {
    throw new Error(`Could not find Xcode project files in "${sourceDir}" folder`);
  }
  Logger.debug(
    `Found Xcode ${xcodeProject.isWorkspace ? "workspace" : "project"} ${
      xcodeProject.workspaceLocation || xcodeProject.xcodeprojLocation
    }`
  );

  const scheme = buildOptions?.scheme || (await findXcodeScheme(xcodeProject))[0];
  Logger.debug(`Xcode build will use "${scheme}" scheme`);

  let platformName: string | undefined;
  const buildProcess = cancelToken.adapt(
    buildProject(
      deviceInfo,
      xcodeProject,
      sourceDir,
      scheme,
      buildOptions?.configuration || "Debug",
      forceCleanBuild
    )
  );

  const buildIOSProgressProcessor = new BuildIOSProgressProcessor(progressListener);
  outputChannel.clear();
  lineReader(buildProcess).onLineRead((line) => {
    outputChannel.appendLine(line);
    buildIOSProgressProcessor.processLine(line);
    // Xcode can sometimes escape `=` with a backslash or put the value in quotes
    const platformNameMatch = /export PLATFORM_NAME\\?="?(\w+)"?$/m.exec(line);
    if (platformNameMatch) {
      platformName = platformNameMatch[1];
    }
  });

  await buildProcess;

  if (!platformName) {
    throw new Error(`Couldn't find "PLATFORM_NAME" in xcodebuild output`);
  }

  const appPath = await getBuildPath(
    xcodeProject,
    sourceDir,
    platformName,
    scheme,
    buildOptions?.configuration || "Debug",
    cancelToken
  );

  const bundleID = await getBundleID(appPath);

  return { appPath, bundleID, platform: DevicePlatform.IOS };
}

async function getBuildPath(
  xcodeProject: IOSProjectInfo,
  projectDir: string,
  platformName: string,
  scheme: string,
  configuration: string,
  cancelToken: CancelToken
) {
  type KnownSettings = "WRAPPER_EXTENSION" | "TARGET_BUILD_DIR" | "EXECUTABLE_FOLDER_PATH";
  type BuildSettings = {
    action: string; // e.g. "build"
    buildSettings: Record<KnownSettings, string> & Record<string, string>;
    target: string;
  }[];

  const buildSettings = await cancelToken.adapt(
    exec(
      "xcodebuild",
      [
        xcodeProject.isWorkspace ? "-workspace" : "-project",
        xcodeProject.workspaceLocation || xcodeProject.xcodeprojLocation,
        "-scheme",
        scheme,
        "-sdk",
        platformName,
        "-configuration",
        configuration,
        "-showBuildSettings",
        "-json",
      ],
      { encoding: "utf8", cwd: projectDir }
    )
  );

  const settings: BuildSettings = JSON.parse(buildSettings.stdout);
  const {
    WRAPPER_EXTENSION: wrapperExtension,
    TARGET_BUILD_DIR: targetBuildDir,
    EXECUTABLE_FOLDER_PATH: executableFolderPath,
  } = settings[0].buildSettings;
  // Find app in all building settings - look for WRAPPER_EXTENSION: 'app',
  if (wrapperExtension !== "app") {
    throw new Error("Failed to get the target build directory and app name.");
  }

  return `${targetBuildDir}/${executableFolderPath}`;
}
