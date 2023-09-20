const child_process = require("child_process");
const path = require("path");
import { IOSProjectInfo } from "@react-native-community/cli-types";
import loadConfig from "@react-native-community/cli-config";
import { isPackagerRunning } from "@react-native-community/cli-tools";

import { Device } from "@react-native-community/cli-platform-ios/build/types";
import { BuildFlags, buildProject } from "./buildProject";
import { getConfigurationScheme } from "@react-native-community/cli-platform-ios/build/tools/getConfigurationScheme";

export async function runIOS(workspaceDir: string, port: number) {
  const packagerStatus = await isPackagerRunning(port);
  const ctx = loadConfig(workspaceDir);

  const { xcodeProject, sourceDir } = ctx.project.ios!;

  if (!xcodeProject) {
    throw new Error(`Could not find Xcode project files in "${sourceDir}" folder`);
  }

  const scheme = path.basename(xcodeProject.name, path.extname(xcodeProject.name)) as string;

  console.log(
    `Found Xcode ${xcodeProject.isWorkspace ? "workspace" : "project"} ${xcodeProject.name}"`
  );

  const buildFlags: BuildFlags = {
    mode: getConfigurationScheme({ scheme, mode: "" }, sourceDir),
    verbose: true,
    buildCwd: sourceDir,
    port: port,
  };

  await runOnPreviewSimulator(xcodeProject, scheme, buildFlags);
}

async function runOnPreviewSimulator(
  xcodeProject: IOSProjectInfo,
  scheme: string,
  args: BuildFlags
) {
  const simulatorData = getSimulatorData();

  const allDevices = Object.keys(simulatorData.devices)
    .map((key) => simulatorData.devices[key])
    .reduce((acc, val) => acc.concat(val), []);

  let simulator = allDevices.find((device) => device.name === "RNPreviews")!;
  if (!simulator) {
    // create simulator
    // simulator =
  }
  if (simulator.state !== "Booted") {
    bootSimulator(simulator);
  }

  const buildOutput = await buildProject(xcodeProject, undefined, scheme, args);
  const appPath = await getBuildPath(
    xcodeProject,
    args.buildCwd,
    "Debug",
    buildOutput,
    scheme,
    undefined
  );

  console.log(`Installing "${appPath}" on "${simulator.name}"`);

  child_process.spawnSync(
    "xcrun",
    ["simctl", "--set", "previews", "install", "RNPreviews", appPath],
    {
      stdio: "inherit",
    }
  );

  const bundleID = child_process
    .execFileSync(
      "/usr/libexec/PlistBuddy",
      ["-c", "Print:CFBundleIdentifier", path.join(appPath, "Info.plist")],
      { encoding: "utf8" }
    )
    .trim();

  console.log(`Launching "${bundleID}"`);

  const result = child_process.spawnSync("xcrun", [
    "simctl",
    "--set",
    "previews",
    "launch",
    "--terminate-running-process",
    "RNPreviews",
    bundleID,
  ]);

  if (result.status === 0) {
    console.log("Successfully launched the app on the simulator");
  } else {
    console.log("Failed to launch the app on simulator", result.stderr.toString());
  }
}

function bootSimulator(selectedSimulator: Device) {
  console.log("Launching simulator", selectedSimulator.udid);

  child_process.spawnSync("xcrun", ["simctl", "--set", "previews", "boot", selectedSimulator.udid]);
}

async function getTargetPaths(buildSettings: string, scheme: string, target: string | undefined) {
  const settings = JSON.parse(buildSettings);

  const targets = settings.map(({ target: settingsTarget }: any) => settingsTarget);

  let selectedTarget = targets[0];

  if (target) {
    if (!targets.includes(target)) {
      console.log(
        `Target ${target} not found for scheme ${scheme}, automatically selected target ${selectedTarget}`
      );
    } else {
      selectedTarget = target;
    }
  }

  // Find app in all building settings - look for WRAPPER_EXTENSION: 'app',

  const targetIndex = targets.indexOf(selectedTarget);

  const wrapperExtension = settings[targetIndex].buildSettings.WRAPPER_EXTENSION;

  if (wrapperExtension === "app") {
    return {
      targetBuildDir: settings[targetIndex].buildSettings.TARGET_BUILD_DIR,
      executableFolderPath: settings[targetIndex].buildSettings.EXECUTABLE_FOLDER_PATH,
    };
  }

  return {};
}

async function getBuildPath(
  xcodeProject: IOSProjectInfo,
  projectDir: string,
  mode: BuildFlags["mode"],
  buildOutput: string,
  scheme: string,
  target: string | undefined,
  isCatalyst: boolean = false
) {
  const buildSettings = child_process.execFileSync(
    "xcodebuild",
    [
      xcodeProject.isWorkspace ? "-workspace" : "-project",
      xcodeProject.name,
      "-scheme",
      scheme,
      "-sdk",
      getPlatformName(buildOutput),
      "-configuration",
      mode,
      "-showBuildSettings",
      "-json",
    ],
    { encoding: "utf8", cwd: projectDir }
  );

  const { targetBuildDir, executableFolderPath } = await getTargetPaths(
    buildSettings,
    scheme,
    target
  );

  if (!targetBuildDir) {
    throw new Error("Failed to get the target build directory.");
  }

  if (!executableFolderPath) {
    throw new Error("Failed to get the app name.");
  }

  return `${targetBuildDir}${isCatalyst ? "-maccatalyst" : ""}/${executableFolderPath}`;
}

function getSimulatorData() {
  let simulators: { devices: { [index: string]: Array<Device> } };

  try {
    simulators = JSON.parse(
      child_process.execFileSync(
        "xcrun",
        ["simctl", "--set", "previews", "list", "--json", "devices"],
        {
          encoding: "utf8",
        }
      )
    );
  } catch (error) {
    throw new Error(
      "Could not get the simulator list from Xcode. Please open Xcode and try running project directly from there to resolve the remaining issues."
    );
  }
  return simulators;
}

function getPlatformName(buildOutput: string) {
  // Xcode can sometimes escape `=` with a backslash or put the value in quotes
  const platformNameMatch = /export PLATFORM_NAME\\?="?(\w+)"?$/m.exec(buildOutput);
  if (!platformNameMatch) {
    throw new Error(
      'Couldn\'t find "PLATFORM_NAME" variable in xcodebuild output. Please report this issue and run your project with Xcode instead.'
    );
  }
  return platformNameMatch[1];
}
