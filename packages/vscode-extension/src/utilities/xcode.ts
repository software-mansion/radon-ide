import path from "path";
import { RelativePattern, workspace } from "vscode";
import { Logger } from "../Logger";
import { getProjectConfig } from "@react-native-community/cli-config-apple";
const getIOSProjectConfig = getProjectConfig({ platformName: "ios" });

export type IOSProjectInfo = {
  xcodeProjectLocation: string;
  isWorkspace: boolean;
};

export async function findXcodeScheme(xcodeProject: IOSProjectInfo) {
  const basename = xcodeProject.xcodeProjectLocation
    ? path.basename(xcodeProject.xcodeProjectLocation, ".xcworkspace")
    : path.basename(xcodeProject.xcodeProjectLocation, ".xcodeproj");

  // we try to search for the scheme name under .xcodeproj/xcshareddata/xcschemes
  const schemeFiles = await workspace.findFiles(
    new RelativePattern(xcodeProject.xcodeProjectLocation, "**/xcshareddata/xcschemes/*.xcscheme")
  );
  if (schemeFiles.length === 1) {
    return [path.basename(schemeFiles[0].fsPath, ".xcscheme")];
  } else if (schemeFiles.length > 1) {
    Logger.warn(
      `Ambiguous scheme files in ${xcodeProject.xcodeProjectLocation}, using workspace name "${basename}" as scheme`
    );
    return schemeFiles.map((schemeFile) => {
      return path.basename(schemeFile.fsPath, ".xcscheme");
    });
  }
  Logger.warn(
    `Could not find any scheme files in ${xcodeProject.xcodeProjectLocation}, using workspace name "${basename}" as scheme`
  );
  return [basename];
}

export function findXcodeProject(appRootFolder: string): IOSProjectInfo | null {
  try {
    const projectConfig = getIOSProjectConfig(appRootFolder, { sourceDir: "ios" });
    if (!projectConfig || !projectConfig.xcodeProject) {
      return null;
    }
    const xcodeProjectLocation = path.join(
      appRootFolder,
      "ios",
      projectConfig.xcodeProject.path,
      projectConfig.xcodeProject.name
    );
    return {
      xcodeProjectLocation,
      isWorkspace: projectConfig.xcodeProject.isWorkspace,
    };
  } catch (error) {
    return null;
  }
}
