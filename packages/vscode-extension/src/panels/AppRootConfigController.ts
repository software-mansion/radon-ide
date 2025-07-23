import path from "path";
import { workspace } from "vscode";
import { AppRootConfig } from "../common/AppRootConfig";
import { findXcodeProject, findXcodeScheme } from "../utilities/xcode";
import { Logger } from "../Logger";
import { getIosSourceDir } from "../builders/buildIOS";
import { readEasConfig } from "../utilities/eas";
import { EasBuildConfig } from "../common/EasConfig";
import { getAvailableApplicationRoots } from "../utilities/getAvailableApplicationRoots";
import { getIOSConfiguration } from "../utilities/launchConfiguration";

function toAbsolutePath(appRoot: string): string {
  return path.resolve(workspace.workspaceFolders![0].uri.fsPath, appRoot);
}

export class AppRootConfigController implements AppRootConfig {
  async getAvailableApplicationRoots() {
    return getAvailableApplicationRoots();
  }

  async getAvailableXcodeSchemes(appRoot: string) {
    if (getIOSConfiguration()) {
      return [];
    }
    const absoluteAppRoot = toAbsolutePath(appRoot);
    const sourceDir = getIosSourceDir(absoluteAppRoot);

    const xcodeProject = findXcodeProject(absoluteAppRoot);

    if (!xcodeProject) {
      Logger.debug(`Could not find Xcode project files in "${sourceDir}" folder`);
      return [];
    }

    Logger.debug(
      `Found Xcode ${xcodeProject.isWorkspace ? "workspace" : "project"} ${
        xcodeProject.xcodeProjectLocation
      }`
    );
    return await findXcodeScheme(xcodeProject);
  }

  async getAvailableEasProfiles(appRoot: string): Promise<EasBuildConfig> {
    const absoluteAppRoot = toAbsolutePath(appRoot);
    const easConfig = await readEasConfig(absoluteAppRoot);
    const easBuildConfig = easConfig?.build ?? {};
    return easBuildConfig;
  }
}
