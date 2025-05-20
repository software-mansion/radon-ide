import path from "path";
import { EventEmitter } from "stream";
import { ConfigurationChangeEvent, workspace, Disposable } from "vscode";
import {
  ApplicationRoot,
  LaunchConfig,
  LaunchConfigEventListener,
  LaunchConfigEventMap,
  LaunchConfigurationOptions,
} from "../common/LaunchConfig";
import { extensionContext, findAppRootCandidates } from "../utilities/extensionContext";
import { findXcodeProject, findXcodeScheme } from "../utilities/xcode";
import { Logger } from "../Logger";
import { getIosSourceDir } from "../builders/buildIOS";
import { readEasConfig } from "../utilities/eas";
import { EasBuildConfig } from "../common/EasConfig";
import { getLaunchConfiguration } from "../utilities/launchConfiguration";

const CUSTOM_APPLICATION_ROOTS_KEY = "custom_application_roots_key";

function readApplicationRoot(appRootPath: string): ApplicationRoot {
  const appRootAbsolutePath = path.resolve(workspace.workspaceFolders![0].uri.fsPath, appRootPath);
  try {
    const appRootConfig = require(appRootAbsolutePath + "/app.json");
    if (appRootConfig) {
      return {
        path: appRootPath,
        name: appRootConfig.name ?? appRootConfig.expo?.name ?? path.basename(appRootPath),
        displayName: appRootConfig.displayName,
      };
    }
  } catch {}
  try {
    const configProvider = require(appRootAbsolutePath + "/app.config.js");
    const appRootConfig = configProvider({ config: {} });
    if (appRootConfig) {
      return {
        path: appRootPath,
        name: appRootConfig.name ?? appRootConfig.expo?.name ?? path.basename(appRootPath),
        displayName: appRootConfig.displayName,
      };
    }
  } catch {}
  try {
    const appPackageJson = require(appRootAbsolutePath + "/package.json");
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

export class LaunchConfigController implements Disposable, LaunchConfig {
  private config: LaunchConfigurationOptions;
  private eventEmitter = new EventEmitter();
  private configListener: Disposable;

  constructor(private readonly appRootFolder: string) {
    this.config = getLaunchConfiguration();

    this.configListener = workspace.onDidChangeConfiguration((event: ConfigurationChangeEvent) => {
      if (!event.affectsConfiguration("launch")) {
        return;
      }

      this.config = getLaunchConfiguration();

      this.eventEmitter.emit("launchConfigChange", this.config);
    });
  }

  async getConfig() {
    return this.config;
  }

  async update<K extends keyof LaunchConfigurationOptions>(
    key: K,
    value: LaunchConfigurationOptions[K] | "Auto"
  ) {
    const configurations = workspace.getConfiguration("launch");

    const newLaunchConfig = { ...this.config, [key]: value !== "Auto" ? value : undefined };

    const oldConfigurations = configurations.get<Array<Record<string, any>>>("configurations");

    let RNIDEConfigurationExits = false;

    const newConfigurations = oldConfigurations?.map((configuration) => {
      if (configuration.type !== "react-native-ide" && configuration.type !== "radon-ide") {
        // for compatibility we want to support old configuration type name
        return configuration;
      }
      RNIDEConfigurationExits = true;
      return { ...configuration, ...newLaunchConfig };
    });

    if (!RNIDEConfigurationExits) {
      newConfigurations?.push({
        type: "radon-ide",
        request: "launch",
        name: "Radon IDE panel",
        ...newLaunchConfig,
      });
    }

    await configurations.update("configurations", newConfigurations);
  }

  async addCustomApplicationRoot(appRoot: string) {
    const oldCustomApplicationRoots =
      extensionContext.workspaceState.get<string[] | undefined>(CUSTOM_APPLICATION_ROOTS_KEY) ?? [];

    const newCustomApplicationRoots = [...oldCustomApplicationRoots, appRoot];

    extensionContext.workspaceState.update(CUSTOM_APPLICATION_ROOTS_KEY, newCustomApplicationRoots);

    this.eventEmitter.emit("applicationRootsChanged");
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

  async getAvailableXcodeSchemes() {
    const appRoot = this.appRootFolder;
    const sourceDir = getIosSourceDir(appRoot);

    const xcodeProject = await findXcodeProject(appRoot);

    if (!xcodeProject) {
      Logger.debug(`Could not find Xcode project files in "${sourceDir}" folder`);
      return [];
    }

    Logger.debug(
      `Found Xcode ${xcodeProject.isWorkspace ? "workspace" : "project"} ${
        xcodeProject.workspaceLocation || xcodeProject.xcodeprojLocation
      }`
    );
    return await findXcodeScheme(xcodeProject);
  }

  async getAvailableEasProfiles(): Promise<EasBuildConfig> {
    const appRoot = this.appRootFolder;
    const easConfig = await readEasConfig(appRoot);
    const easBuildConfig = easConfig?.build ?? {};
    return easBuildConfig;
  }

  async addListener<K extends keyof LaunchConfigEventMap>(
    eventType: K,
    listener: LaunchConfigEventListener<LaunchConfigEventMap[K]>
  ) {
    this.eventEmitter.addListener(eventType, listener);
  }

  async removeListener<K extends keyof LaunchConfigEventMap>(
    eventType: K,
    listener: LaunchConfigEventListener<LaunchConfigEventMap[K]>
  ) {
    this.eventEmitter.removeListener(eventType, listener);
  }

  dispose() {
    this.configListener.dispose();
  }
}
