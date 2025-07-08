import path from "path";
import { workspace } from "vscode";
import { ApplicationRoot, AppRootConfig } from "../common/AppRootConfig";
import { extensionContext, findAppRootCandidates } from "../utilities/extensionContext";
import { findXcodeProject, findXcodeScheme } from "../utilities/xcode";
import { Logger } from "../Logger";
import { getIosSourceDir } from "../builders/buildIOS";
import { readEasConfig } from "../utilities/eas";
import { EasBuildConfig } from "../common/EasConfig";
import { requireNoCache } from "../utilities/requireNoCache";

const CUSTOM_APPLICATION_ROOTS_KEY = "custom_application_roots_key";

function readApplicationRootFromStaticConfig(appRootPath: string, configAbsolutePath: string) {
  const appRootConfig = requireNoCache(configAbsolutePath);
  if (appRootConfig) {
    return {
      path: appRootPath,
      name: appRootConfig.name ?? appRootConfig.expo?.name ?? path.basename(appRootPath),
      displayName: appRootConfig.displayName,
    };
  }
  throw new Error("Could not read config file.");
}

function readApplicationRoot(appRootPath: string): ApplicationRoot {
  const appRootAbsolutePath = path.resolve(workspace.workspaceFolders![0].uri.path, appRootPath);
  try {
    return readApplicationRootFromStaticConfig(appRootPath, appRootAbsolutePath + "/app.json");
  } catch {}
  try {
    return readApplicationRootFromStaticConfig(
      appRootPath,
      appRootAbsolutePath + "/app.config.json"
    );
  } catch {}
  try {
    const appPackageJson = requireNoCache(appRootAbsolutePath + "/package.json");
    return {
      path: appRootPath,
      name: appPackageJson.name ?? path.basename(appRootPath),
    };
  } catch {}
  return {
    path: appRootPath,
    name: path.basename(appRootPath),
  };
}

export class AppRootConfigController implements AppRootConfig {
  async addCustomApplicationRoot(appRoot: string) {
    const oldCustomApplicationRoots =
      extensionContext.workspaceState.get<string[] | undefined>(CUSTOM_APPLICATION_ROOTS_KEY) ?? [];

    const newCustomApplicationRoots = [...oldCustomApplicationRoots, appRoot];

    extensionContext.workspaceState.update(CUSTOM_APPLICATION_ROOTS_KEY, newCustomApplicationRoots);

    return newCustomApplicationRoots.map(readApplicationRoot);
  }

  async getAvailableApplicationRoots() {
    const workspacePath = workspace.workspaceFolders![0].uri.fsPath;
    const applicationRootsCandidates = findAppRootCandidates().map((candidate) => {
      return "./" + path.relative(workspacePath, candidate);
    });
    const customApplicationRoots =
      extensionContext.workspaceState.get<string[] | undefined>(CUSTOM_APPLICATION_ROOTS_KEY) ?? [];

    const applicationRoots = [...applicationRootsCandidates, ...customApplicationRoots];

    if (!applicationRoots) {
      Logger.debug(`Could not find any application roots.`);
      return [];
    }

    return applicationRoots.map(readApplicationRoot);
  }

  async getAvailableXcodeSchemes(appRoot?: string) {
    if (!appRoot) {
      const appRootCandidates = findAppRootCandidates();
      if (appRootCandidates.length === 0) {
        return [];
      }
      appRoot = appRootCandidates[0];
    }
    const absoluteAppRoot = path.resolve(workspace.workspaceFolders![0].uri.fsPath, appRoot);
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

  async getAvailableEasProfiles(appRoot?: string): Promise<EasBuildConfig> {
    if (!appRoot) {
      const appRootCandidates = findAppRootCandidates();
      if (appRootCandidates.length === 0) {
        return {};
      }
      appRoot = appRootCandidates[0];
    }
    const absoluteAppRoot = path.resolve(workspace.workspaceFolders![0].uri.fsPath, appRoot);
    const easConfig = await readEasConfig(absoluteAppRoot);
    const easBuildConfig = easConfig?.build ?? {};
    return easBuildConfig;
  }
}
