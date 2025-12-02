import path from "path";
import { RelativePattern, workspace } from "vscode";
import { getProjectConfig, findPbxprojFile } from "@react-native-community/cli-config-apple";
import { Logger } from "../Logger";
const getIOSProjectConfig = getProjectConfig({ platformName: "ios" });

export type IOSProjectInfo = {
  xcodeProjectLocation: string;
  isWorkspace: boolean;
};

export async function findXcodeScheme(xcodeProject: IOSProjectInfo) {
  const basename = xcodeProject.isWorkspace
    ? path.basename(xcodeProject.xcodeProjectLocation, ".xcworkspace")
    : path.basename(xcodeProject.xcodeProjectLocation, ".xcodeproj");
  const projectFile = findPbxprojFile({
    name: path.basename(xcodeProject.xcodeProjectLocation),
    path: path.dirname(xcodeProject.xcodeProjectLocation),
    isWorkspace: xcodeProject.isWorkspace,
  });
  const projectDir = path.dirname(projectFile);

  // we try to search for the scheme name under .xcodeproj/xcshareddata/xcschemes
  const schemeFiles = await workspace.findFiles(
    new RelativePattern(projectDir, "**/xcshareddata/xcschemes/*.xcscheme")
  );
  if (schemeFiles.length >= 1) {
    return schemeFiles.map((schemeFile) => path.basename(schemeFile.fsPath, ".xcscheme"));
  }
  Logger.warn(
    `Could not find any scheme files in ${projectDir}, using workspace name "${basename}" as scheme`
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
