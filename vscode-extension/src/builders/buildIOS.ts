import { RelativePattern, workspace, Uri } from "vscode";
import { BuildFlags, buildProject } from "./buildProject";
import { exec } from "../utilities/subprocess";
import { Logger } from "../Logger";
import path from "path";
import { IOSProjectInfo } from "../utilities/ios";
import { checkIosDependenciesInstalled } from "../dependency/DependencyChecker";
import { installIOSDependencies } from "../dependency/DependencyInstaller";
import { CancelToken } from "./BuildManager";

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

export async function findXcodeProject(appRootFolder: string) {
  const iosSourceDir = getIosSourceDir(appRootFolder);
  const xcworkspaceFiles = await workspace.findFiles(
    new RelativePattern(iosSourceDir, "**/*.xcworkspace/*"),
    "**/{node_modules,build,Pods}/**",
    1
  );

  if (xcworkspaceFiles.length === 1) {
    return {
      name: Uri.joinPath(xcworkspaceFiles[0], "..").fsPath,
      isWorkspace: true,
    };
  }

  const xcodeprojFiles = await workspace.findFiles(
    new RelativePattern(iosSourceDir, "**/*.xcodeproj/*"),
    "**/{node_modules,build,Pods}/**",
    1
  );

  if (xcodeprojFiles.length === 1) {
    return {
      name: Uri.joinPath(xcodeprojFiles[0], "..").fsPath,
      isWorkspace: false,
    };
  }

  return null;
}

export async function buildIos(
  appRootFolder: string,
  forceCleanBuild: boolean,
  cancelToken: CancelToken
) {
  const sourceDir = getIosSourceDir(appRootFolder);

  const isPodsInstalled = await checkIosDependenciesInstalled();
  if (!isPodsInstalled) {
    await cancelToken.adapt(installIOSDependencies(appRootFolder, forceCleanBuild));
  }

  const xcodeProject = await findXcodeProject(appRootFolder);

  if (!xcodeProject) {
    throw new Error(`Could not find Xcode project files in "${sourceDir}" folder`);
  }

  const scheme = path.basename(xcodeProject.name, path.extname(xcodeProject.name)) as string;

  Logger.debug(
    `Found Xcode ${xcodeProject.isWorkspace ? "workspace" : "project"} ${xcodeProject.name}`
  );

  const buildFlags: BuildFlags = {
    mode: "Debug", // Users may have custom modes (like "Staging") defined in their projects but just "Debug" is fine for now
    verbose: true,
    buildCwd: sourceDir,
    cleanBuild: forceCleanBuild,
  };

  const { stdout } = await cancelToken.adapt(
    buildProject(xcodeProject, undefined, scheme, buildFlags)
  );
  const appPath = await getBuildPath(
    xcodeProject,
    buildFlags.buildCwd,
    "Debug",
    stdout,
    scheme,
    undefined,
    false,
    cancelToken
  );

  const bundleID = await getBundleID(appPath);

  return { appPath, bundleID };
}

async function getTargetPaths(buildSettings: string, scheme: string, target: string | undefined) {
  const settings = JSON.parse(buildSettings);

  const targets = settings.map(({ target: settingsTarget }: any) => settingsTarget);

  let selectedTarget = targets[0];

  if (target) {
    if (!targets.includes(target)) {
      Logger.debug(
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
  isCatalyst: boolean = false,
  cancelToken: CancelToken
) {
  const buildSettings = await cancelToken.adapt(
    exec(
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
    )
  );

  const { targetBuildDir, executableFolderPath } = await getTargetPaths(
    buildSettings.stdout,
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
