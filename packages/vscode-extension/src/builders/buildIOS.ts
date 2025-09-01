import path from "path";
import { exec, lineReader } from "../utilities/subprocess";
import { Logger } from "../Logger";
import { CancelToken } from "../utilities/cancelToken";
import { BuildIOSProgressProcessor } from "./BuildIOSProgressProcessor";
import { EXPO_GO_BUNDLE_ID, downloadExpoGo } from "./expoGo";
import { findXcodeProject, findXcodeScheme, IOSProjectInfo } from "../utilities/xcode";
import { runExternalBuild } from "./customBuild";
import { fetchEasBuild, performLocalEasBuild } from "./eas";
import { calculateAppArtifactHash, calculateMD5 } from "../utilities/common";
import { getTelemetryReporter } from "../utilities/telemetry";
import { BuildType, IOSBuildConfig, IOSLocalBuildConfig } from "../common/BuildConfig";
import { DevicePlatform, DeviceRotation } from "../common/State";
import { BuildOptions } from "./BuildManager";
import {
  createSimulatorWithRuntimeId,
  listSimulators,
  removeIosSimulator,
  SimulatorDeviceSet,
} from "../devices/IosSimulatorDevice";

// Mapping from iOS interface orientation strings to DeviceRotation enum
const IOS_ORIENTATION_TO_DEVICE_ROTATION = {
  UIInterfaceOrientationPortrait: DeviceRotation.Portrait,
  UIInterfaceOrientationPortraitUpsideDown: DeviceRotation.PortraitUpsideDown,
  // Landscape orientations are swapped on IOS
  UIInterfaceOrientationLandscapeLeft: DeviceRotation.LandscapeRight,
  UIInterfaceOrientationLandscapeRight: DeviceRotation.LandscapeLeft,
} as const;

export type IOSBuildResult = {
  platform: DevicePlatform.IOS;
  appPath: string;
  bundleID: string;
  buildHash: string;
  supportedInterfaceOrientations: DeviceRotation[];
};

// Assuming users have ios folder in their project's root
export const getIosSourceDir = (appRootFolder: string) => path.join(appRootFolder, "ios");

async function getDataFromPlistFile(key: string, appPath: string): Promise<string> {
  return (
    await exec("/usr/libexec/PlistBuddy", ["-c", `Print:${key}`, path.join(appPath, "Info.plist")])
  ).stdout;
}

async function getBundleID(appPath: string) {
  return await getDataFromPlistFile("CFBundleIdentifier", appPath);
}
async function getSupportedInterfaceOrientations(appPath: string) {
  const data = await getDataFromPlistFile("UISupportedInterfaceOrientations", appPath);
  const lines = data.split("\n");

  let orientations = lines
    .map((line) => line.trim()) // Trim each line to clean whitespace
    .filter((line) => line.length > 0 && line !== "Array {" && line !== "}") // Filter out empty lines and braces
    .map(
      (line) =>
        IOS_ORIENTATION_TO_DEVICE_ROTATION[line as keyof typeof IOS_ORIENTATION_TO_DEVICE_ROTATION]
    )
    .filter((orientation) => orientation !== undefined) as DeviceRotation[];

  return orientations;
}

// IPAD BUILDING NOTE:
// The only difference between building for iPhone and iPad is the
// TARGETED_DEVICE_FAMILY build setting, which is set to "1,2" for
// iPhone and iPad support, and "1" for iPhone only.
// The build time is similiar when compared to building for iPhone-only
// and it allows to run the app on both devices without rebuilding.
// Additionally, the build time is reduced when DerivedData already exists for
// iPhone-only build, so the first build, if old DerivedData exists, before 1.10.0,
// will be faster than building from scratch.

function buildProject(
  xcodeProject: IOSProjectInfo,
  buildDir: string,
  scheme: string,
  configuration: string,
  simulatorId: string,
  cleanBuild: boolean,
  env: Record<string, string>
) {
  const xcodebuildArgs = [
    xcodeProject.isWorkspace ? "-workspace" : "-project",
    xcodeProject.xcodeProjectLocation,
    "-configuration",
    configuration,
    "TARGETED_DEVICE_FAMILY=1,2",
    'OTHER_CFLAGS="-DREACT_NATIVE_DEBUGGER_ENABLED=1"',
    "-scheme",
    scheme,
    "-destination",
    `id=${simulatorId}`,
    "-showBuildTimingSummary",
    "-destination-timeout",
    "1", // this is the lowest possible value, using "0" means no timeout at all. This timeout allows us to fail fast when simulator with provided ID doesn't exists. Otherwise xcodebuild wait for USB connected device with such ID.
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
  buildOptions: BuildOptions
): Promise<IOSBuildResult> {
  const { appRoot, env, type: buildType } = buildConfig;
  const { cancelToken, buildOutputChannel } = buildOptions;
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
        buildOutputChannel
      );
      if (!appPath) {
        throw new Error(
          "Failed to build iOS app using custom script. See the build logs for details."
        );
      }

      return {
        appPath,
        bundleID: await getBundleID(appPath),
        supportedInterfaceOrientations: await getSupportedInterfaceOrientations(appPath),
        platform: DevicePlatform.IOS,
        buildHash: await calculateAppArtifactHash(appPath),
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
        buildOutputChannel
      );

      return {
        appPath,
        bundleID: await getBundleID(appPath),
        supportedInterfaceOrientations: await getSupportedInterfaceOrientations(appPath),
        platform: DevicePlatform.IOS,
        buildHash: await calculateAppArtifactHash(appPath),
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
        buildOutputChannel,
        cancelToken
      );

      return {
        appPath,
        bundleID: await getBundleID(appPath),
        supportedInterfaceOrientations: await getSupportedInterfaceOrientations(appPath),
        platform: DevicePlatform.IOS,
        buildHash: await calculateAppArtifactHash(appPath),
      };
    }
    case BuildType.ExpoGo: {
      getTelemetryReporter().sendTelemetryEvent("build:expo-go-requested", {
        platform: DevicePlatform.IOS,
      });
      const appPath = await downloadExpoGo(DevicePlatform.IOS, cancelToken, appRoot);
      const supportedInterfaceOrientations = await getSupportedInterfaceOrientations(appPath);
      return {
        appPath,
        bundleID: EXPO_GO_BUNDLE_ID,
        supportedInterfaceOrientations,
        platform: DevicePlatform.IOS,
        buildHash: await calculateAppArtifactHash(appPath),
      };
    }
    case BuildType.Local: {
      return await buildLocal(buildConfig, buildOptions);
    }
  }
}

async function getOrMakeSimulator(buildConfig: IOSLocalBuildConfig) {
  const { runtimeId } = buildConfig;
  const devices = await listSimulators(SimulatorDeviceSet.Default); // use default location becuase xcodebuild can't use custom device sets
  const matchingDevice = devices.find(
    (deviceInfo) => deviceInfo.runtimeInfo?.identifier === runtimeId && deviceInfo.available
  );
  if (matchingDevice) {
    Logger.info("Using existing simulator for iOS build:", matchingDevice);
    return {
      simulatorUdid: matchingDevice.UDID,
      cleanupSimulator: async () => {
        /* noop - don't delete simulators from default device set */
      },
    };
  }
  Logger.info("Creating new simulator for iOS build:", runtimeId);
  // It is unlikely we will reach this point as it may only happen when user doesn't have simulator for the selected runtime available
  // The above is possible but when Xcode installs new SDK, it also creates a set of simulators for it
  // Thereofre, this can only happen when the user has deleted all of the simulator or if they deleted the runtime
  // in which case we won't be able to create a new simulator for it anyways and the build should fail.
  const simulatorUdid = await createSimulatorWithRuntimeId(
    "iPhone 16 Pro", // device type doesn't matter as long as it supports the runtime, we choose iPhone 16 as it is recent and will be available for a while
    "Radon IDE Temp Simulator",
    runtimeId,
    SimulatorDeviceSet.Default
  );
  if (simulatorUdid) {
    return {
      simulatorUdid,
      cleanupSimulator: async () => {
        try {
          await removeIosSimulator(simulatorUdid, SimulatorDeviceSet.Default);
        } catch (e) {
          Logger.error("Error removing simulator", e);
        }
      },
    };
  } else {
    throw new Error("Failed to create simulator for build");
  }
}

async function buildLocal(
  buildConfig: IOSLocalBuildConfig,
  buildOptions: BuildOptions
): Promise<IOSBuildResult> {
  const { appRoot, configuration = "Debug" } = buildConfig;
  const { progressListener, cancelToken, buildOutputChannel, forceCleanBuild } = buildOptions;

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

  const { simulatorUdid, cleanupSimulator } = await getOrMakeSimulator(buildConfig);

  try {
    const buildProcess = cancelToken.adapt(
      buildProject(
        xcodeProject,
        sourceDir,
        scheme,
        configuration,
        simulatorUdid,
        forceCleanBuild,
        buildConfig.env ?? {}
      )
    );

    const buildIOSProgressProcessor = new BuildIOSProgressProcessor(progressListener);
    lineReader(buildProcess).onLineRead((line) => {
      buildOutputChannel.appendLine(line);
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
      const appPath = await getBuildPath(
        xcodeProject,
        sourceDir,
        scheme,
        configuration,
        simulatorUdid,
        cancelToken
      );
      const bundleID = await getBundleID(appPath);
      const supportedInterfaceOrientations = await getSupportedInterfaceOrientations(appPath);
      const buildHash = (await calculateMD5(appPath)).digest("hex");
      return {
        appPath,
        bundleID,
        buildHash,
        supportedInterfaceOrientations,
        platform: DevicePlatform.IOS,
      };
    } catch (e) {
      Logger.error("Error getting app path", e);
      throw new Error(
        "The iOS app build was successful, but the app file could not be accessed. See the build logs for details."
      );
    }
  } finally {
    await cleanupSimulator();
  }
}

async function getBuildPath(
  xcodeProject: IOSProjectInfo,
  projectDir: string,
  scheme: string,
  configuration: string,
  simulatorId: string,
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
        "-destination",
        `id=${simulatorId}`,
        "-destination-timeout",
        "1",
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
