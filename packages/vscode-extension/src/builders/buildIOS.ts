import path from "path";
import { OutputChannel } from "vscode";
import { exec, lineReader } from "../utilities/subprocess";
import { Logger } from "../Logger";
import { CancelToken } from "../utilities/cancelToken";
import { BuildIOSProgressProcessor } from "./BuildIOSProgressProcessor";
import { DevicePlatform } from "../common/DeviceManager";
import { EXPO_GO_BUNDLE_ID, downloadExpoGo } from "./expoGo";
import { findXcodeProject, findXcodeScheme, IOSProjectInfo } from "../utilities/xcode";
import { runExternalBuild } from "./customBuild";
import { fetchEasBuild, performLocalEasBuild } from "./eas";
import { getXcodebuildArch } from "../utilities/common";
import { getTelemetryReporter } from "../utilities/telemetry";
import { BuildType, IOSBuildConfig, IOSLocalBuildConfig } from "../common/BuildConfig";

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
  xcodeProject: IOSProjectInfo,
  buildDir: string,
  scheme: string,
  configuration: string,
  cleanBuild: boolean,
  env: Record<string, string>
) {
  const xcodebuildArgs = [
    xcodeProject.isWorkspace ? "-workspace" : "-project",
    xcodeProject.xcodeProjectLocation,
    "-configuration",
    configuration,
    "-scheme",
    scheme,
    "-arch",
    getXcodebuildArch(),
    "-sdk",
    "iphonesimulator",
    "-showBuildTimingSummary",
    "-destination-timeout",
    "0",
    ...(cleanBuild ? ["clean"] : []),
    "build",
  ];

  Logger.debug(`Building using "xcodebuild ${xcodebuildArgs.join(" ")}`);

  return exec("xcodebuild", xcodebuildArgs, {
    env: {
      ...env,
      RCT_NO_LAUNCH_PACKAGER: "true",
    },
    cwd: buildDir,
    buffer: false,
  });
}

export async function buildIos(
  buildConfig: IOSBuildConfig,
  cancelToken: CancelToken,
  outputChannel: OutputChannel,
  progressListener: (newProgress: number) => void
): Promise<IOSBuildResult> {
  const { appRoot, env, type: buildType } = buildConfig;

  switch (buildType) {
    case BuildType.Custom: {
      getTelemetryReporter().sendTelemetryEvent("build:custom-build-requested", {
        platform: DevicePlatform.IOS,
      });
      // We don't autoinstall Pods here to make custom build scripts more flexible

      const appPath = await runExternalBuild(
        cancelToken,
        buildConfig.buildCommand,
        env,
        DevicePlatform.IOS,
        appRoot,
        outputChannel
      );
      if (!appPath) {
        throw new Error(
          "Failed to build iOS app using custom script. See the build logs for details."
        );
      }

      return {
        appPath,
        bundleID: await getBundleID(appPath),
        platform: DevicePlatform.IOS,
      };
    }
    case BuildType.Eas: {
      getTelemetryReporter().sendTelemetryEvent("build:eas-build-requested", {
        platform: DevicePlatform.IOS,
      });

      const appPath = await fetchEasBuild(
        cancelToken,
        buildConfig.config,
        DevicePlatform.IOS,
        appRoot,
        outputChannel
      );

      return {
        appPath,
        bundleID: await getBundleID(appPath),
        platform: DevicePlatform.IOS,
      };
    }
    case BuildType.EasLocal: {
      getTelemetryReporter().sendTelemetryEvent("build:eas-local-build-requested", {
        platform: DevicePlatform.IOS,
      });
      const appPath = await performLocalEasBuild(
        buildConfig.profile,
        DevicePlatform.IOS,
        appRoot,
        outputChannel,
        cancelToken
      );

      return {
        appPath,
        bundleID: await getBundleID(appPath),
        platform: DevicePlatform.IOS,
      };
    }
    case BuildType.ExpoGo: {
      getTelemetryReporter().sendTelemetryEvent("build:expo-go-requested", {
        platform: DevicePlatform.IOS,
      });
      const appPath = await downloadExpoGo(DevicePlatform.IOS, cancelToken, appRoot);
      return { appPath, bundleID: EXPO_GO_BUNDLE_ID, platform: DevicePlatform.IOS };
    }
    case BuildType.Local: {
      return await buildLocal(buildConfig, cancelToken, outputChannel, progressListener);
    }
  }
}

async function buildLocal(
  buildConfig: IOSLocalBuildConfig,
  cancelToken: CancelToken,
  outputChannel: OutputChannel,
  progressListener: (newProgress: number) => void
): Promise<IOSBuildResult> {
  const { appRoot, forceCleanBuild, configuration = "Debug" } = buildConfig;

  const sourceDir = getIosSourceDir(appRoot);

  const xcodeProject = findXcodeProject(appRoot);

  if (!xcodeProject) {
    getTelemetryReporter().sendTelemetryEvent("build:xcode-project-not-found");
    throw new Error(
      `Could not find Xcode project files in "${sourceDir}" folder. Verify the iOS project is set up correctly.`
    );
  }
  Logger.debug(
    `Found Xcode ${xcodeProject.isWorkspace ? "workspace" : "project"} ${
      xcodeProject.xcodeProjectLocation
    }`
  );

  const scheme = buildConfig.scheme ?? (await findXcodeScheme(xcodeProject))[0];

  Logger.debug(`Xcode build will use "${scheme}" scheme`);

  const buildProcess = cancelToken.adapt(
    buildProject(
      xcodeProject,
      sourceDir,
      scheme,
      configuration,
      forceCleanBuild,
      buildConfig.env ?? {}
    )
  );

  const buildIOSProgressProcessor = new BuildIOSProgressProcessor(progressListener);
  lineReader(buildProcess).onLineRead((line) => {
    outputChannel.appendLine(line);
    buildIOSProgressProcessor.processLine(line);
  });

  try {
    await buildProcess;
  } catch (e) {
    Logger.error("Error building iOS project", e);
    throw new Error(
      "Failed to build the iOS app with xcodebuild. Check the build logs for details."
    );
  }

  try {
    const appPath = await getBuildPath(xcodeProject, sourceDir, scheme, configuration, cancelToken);
    const bundleID = await getBundleID(appPath);
    return { appPath, bundleID, platform: DevicePlatform.IOS };
  } catch (e) {
    Logger.error("Error getting app path", e);
    throw new Error(
      "The iOS app build was successful, but the app file could not be accessed. See the build logs for details."
    );
  }
}

async function getBuildPath(
  xcodeProject: IOSProjectInfo,
  projectDir: string,
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
        xcodeProject.xcodeProjectLocation,
        "-scheme",
        scheme,
        "-sdk",
        "iphonesimulator",
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
    throw new Error(
      "Failed to get the target build directory and app name. Check the build logs for details."
    );
  }

  return `${targetBuildDir}/${executableFolderPath}`;
}
