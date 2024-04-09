import { RelativePattern, workspace, Uri, window, OutputChannel } from "vscode";
import { exec, lineReader } from "../utilities/subprocess";
import { Logger } from "../Logger";
import path from "path";
import { checkIosDependenciesInstalled } from "../dependency/DependencyChecker";
import { installIOSDependencies } from "../dependency/DependencyInstaller";
import { CancelToken } from "./BuildManager";
import { BuildIOSProgressProcessor } from "./BuildIOSProgressProcessor";
import { getLaunchConfiguration } from "../utilities/launchConfiguration";

type IOSProjectInfo =
  | {
      workspaceLocation: string;
      xcodeprojLocation: string;
      isWorkspace: true;
    }
  | {
      workspaceLocation: undefined;
      xcodeprojLocation: string;
      isWorkspace: false;
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

export async function findXcodeProject(appRootFolder: string) {
  const iosSourceDir = getIosSourceDir(appRootFolder);
  const xcworkspaceFiles = await workspace.findFiles(
    new RelativePattern(iosSourceDir, "**/*.xcworkspace/*"),
    "**/{node_modules,build,Pods,*.xcodeproj}/**",
    2
  );

  let workspaceLocation: string | undefined;
  if (xcworkspaceFiles.length === 1) {
    workspaceLocation = Uri.joinPath(xcworkspaceFiles[0], "..").fsPath;
  }

  const xcodeprojFiles = await workspace.findFiles(
    new RelativePattern(iosSourceDir, "**/*.xcodeproj/*"),
    "**/{node_modules,build,Pods}/**",
    2
  );

  let xcodeprojLocation: string | undefined;
  if (xcodeprojFiles.length === 1) {
    xcodeprojLocation = Uri.joinPath(xcodeprojFiles[0], "..").fsPath;
  }

  if (xcodeprojLocation) {
    return {
      workspaceLocation,
      xcodeprojLocation,
      isWorkspace: !!workspaceLocation,
    } as IOSProjectInfo;
  }

  return null;
}

function buildProject(
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
    "-destination",
    "generic/platform=iOS Simulator",
    ...(cleanBuild ? ["clean"] : []),
    "build",
  ];

  Logger.debug(`Building using "xcodebuild ${xcodebuildArgs.join(" ")}`);

  return exec("xcodebuild", xcodebuildArgs, {
    env: {
      ...process.env,
      RCT_NO_LAUNCH_PACKAGER: "true",
    },
    cwd: buildDir,
    buffer: false,
  });
}

async function findXcodeScheme(xcodeProject: IOSProjectInfo) {
  const basename = path.basename(xcodeProject.workspaceLocation || xcodeProject.xcodeprojLocation);

  // we try to search for the scheme name under .xcodeproj/xcshareddata/xcschemes
  const schemeFiles = await workspace.findFiles(
    xcodeProject.xcodeprojLocation,
    "**/xcshareddata/xcschemes/*.xcscheme"
  );
  if (schemeFiles.length === 1) {
    return path.basename(schemeFiles[0].fsPath, ".xcscheme");
  } else if (schemeFiles.length === 0) {
    Logger.warn(
      `Could not find any scheme files in ${xcodeProject.xcodeprojLocation}, using workspace name "${basename}" as scheme`
    );
  } else {
    Logger.warn(
      `Ambiguous scheme files in ${xcodeProject.xcodeprojLocation}, using workspace name "${basename}" as scheme`
    );
  }
  return basename;
}

export async function buildIos(
  appRootFolder: string,
  forceCleanBuild: boolean,
  cancelToken: CancelToken,
  outputChannel: OutputChannel,
  progressListener: (newProgress: number) => void
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
  Logger.debug(
    `Found Xcode ${xcodeProject.isWorkspace ? "workspace" : "project"} ${
      xcodeProject.workspaceLocation || xcodeProject.xcodeprojLocation
    }`
  );

  const buildOptions = getLaunchConfiguration();
  const scheme = buildOptions.ios?.scheme || (await findXcodeScheme(xcodeProject));
  Logger.debug(`Xcode build will use "${scheme}" scheme`);

  const buildProcess = cancelToken.adapt(
    buildProject(
      xcodeProject,
      sourceDir,
      scheme,
      buildOptions?.ios?.configuration || "Debug",
      forceCleanBuild
    )
  );

  let platformName: string | undefined;
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

  const appPath = await getBuildPath(xcodeProject, sourceDir, platformName, scheme, cancelToken);

  const bundleID = await getBundleID(appPath);

  return { appPath, bundleID };
}

async function getTargetPaths(buildSettings: string) {
  const settings = JSON.parse(buildSettings);

  const targets = settings.map(({ target: settingsTarget }: any) => settingsTarget);

  let selectedTarget = targets[0];

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
  platformName: string,
  scheme: string,
  cancelToken: CancelToken
) {
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
        "Debug",
        "-showBuildSettings",
        "-json",
      ],
      { encoding: "utf8", cwd: projectDir }
    )
  );

  const { targetBuildDir, executableFolderPath } = await getTargetPaths(buildSettings.stdout);

  if (!targetBuildDir) {
    throw new Error("Failed to get the target build directory.");
  }

  if (!executableFolderPath) {
    throw new Error("Failed to get the app name.");
  }

  return `${targetBuildDir}/${executableFolderPath}`;
}
