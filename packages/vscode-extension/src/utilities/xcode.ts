import path from "path";
import { RelativePattern, Uri, workspace } from "vscode";
import { Logger } from "../Logger";
import { getIosSourceDir } from "../builders/buildIOS";

export type IOSProjectInfo =
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

export async function findXcodeScheme(xcodeProject: IOSProjectInfo) {
  const basename = xcodeProject.workspaceLocation
    ? path.basename(xcodeProject.workspaceLocation, ".xcworkspace")
    : path.basename(xcodeProject.xcodeprojLocation, ".xcodeproj");

  // we try to search for the scheme name under .xcodeproj/xcshareddata/xcschemes
  const schemeFiles = await workspace.findFiles(
    new RelativePattern(xcodeProject.xcodeprojLocation, "**/xcshareddata/xcschemes/*.xcscheme")
  );
  if (schemeFiles.length === 1) {
    return [path.basename(schemeFiles[0].fsPath, ".xcscheme")];
  } else if (schemeFiles.length > 1) {
    Logger.warn(
      `Ambiguous scheme files in ${xcodeProject.xcodeprojLocation}, using workspace name "${basename}" as scheme`
    );
    return schemeFiles.map((schemeFile) => {
      return path.basename(schemeFile.fsPath, ".xcscheme");
    });
  }
  Logger.warn(
    `Could not find any scheme files in ${xcodeProject.xcodeprojLocation}, using workspace name "${basename}" as scheme`
  );
  return [basename];
}

export async function findXcodeProject(appRootFolder: string) {
  function getParentDirectory(filePath: Uri) {
    return Uri.joinPath(filePath, "..").fsPath;
  }

  function inSameDirectory(file1: Uri, file2: Uri) {
    const parentDirectory1 = getParentDirectory(file1);
    const parentDirectory2 = getParentDirectory(file2);

    return parentDirectory1 === parentDirectory2;
  }

  const iosSourceDir = appRootFolder; //getIosSourceDir(appRootFolder);

  const xcworkspaceFiles = await workspace.findFiles(
    new RelativePattern(iosSourceDir, "**/*.xcworkspace/*"),
    "**/{node_modules,build,Pods,vendor,*.xcodeproj}/**",
    2
  );

  let workspaceLocation: string | undefined;
  if (xcworkspaceFiles.length === 2 && !inSameDirectory(xcworkspaceFiles[0], xcworkspaceFiles[1])) {
    Logger.warn(`Found multiple XCode workspace files: ${xcworkspaceFiles.join(", ")}`);
  } else if (xcworkspaceFiles.length >= 1) {
    workspaceLocation = getParentDirectory(xcworkspaceFiles[0]);
  }

  const xcodeprojFiles = await workspace.findFiles(
    new RelativePattern(iosSourceDir, "**/*.xcodeproj/*"),
    "**/{node_modules,build,Pods,vendor}/**",
    2
  );

  let xcodeprojLocation: string | undefined;
  if (xcodeprojFiles.length === 2 && !inSameDirectory(xcodeprojFiles[0], xcodeprojFiles[1])) {
    Logger.warn(`Found multiple XCode project files: ${xcodeprojFiles.join(", ")}`);
  } else if (xcodeprojFiles.length >= 1) {
    xcodeprojLocation = getParentDirectory(xcodeprojFiles[0]);
  }

  if (xcodeprojLocation) {
    return {
      workspaceLocation,
      xcodeprojLocation,
      isWorkspace: workspaceLocation !== undefined,
    } as IOSProjectInfo;
  }

  return null;
}
