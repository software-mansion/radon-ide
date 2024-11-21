import { EventEmitter } from "stream";
import { ConfigurationChangeEvent, workspace, Disposable } from "vscode";
import {
  LaunchConfig,
  LaunchConfigEventListener,
  LaunchConfigEventMap,
  LaunchConfigurationOptions,
} from "../common/LaunchConfig";
import {
  extensionContext,
  findAppRootCandidates,
  getAppRootFolder,
  getCurrentLaunchConfig,
} from "../utilities/extensionContext";
import { findXcodeProject, findXcodeScheme } from "../utilities/xcode";
import { Logger } from "../Logger";
import { getIosSourceDir } from "../builders/buildIOS";
import path from "path";

const CUSTOM_APPLICATION_ROOTS_KEY = "custom_application_roots_key";

export class LaunchConfigController implements Disposable, LaunchConfig {
  private config: LaunchConfigurationOptions;
  private eventEmitter = new EventEmitter();
  private configListener: Disposable;

  constructor() {
    // const getCurrentConfig = (): LaunchConfigurationOptions => {
    //   const launchConfiguration = workspace.getConfiguration(
    //     "launch",
    //     workspace.workspaceFolders![0].uri
    //   );

    //   const configurations = launchConfiguration.get<Array<Record<string, any>>>("configurations")!;

    //   const RNIDEConfiguration = configurations.find(
    //     ({ type }) => type === "react-native-ide" || type === "radon-ide" // for compatibility we want to support old configuration type name
    //   );

    //   if (!RNIDEConfiguration) {
    //     return {};
    //   }

    //   const { android, appRoot, ios, isExpo, metroConfigPath, env } = RNIDEConfiguration;

    //   return { android, appRoot, ios, isExpo, metroConfigPath, env };
    // };

    this.config = getCurrentLaunchConfig();

    this.configListener = workspace.onDidChangeConfiguration((event: ConfigurationChangeEvent) => {
      if (!event.affectsConfiguration("launch")) {
        return;
      }

      this.config = getCurrentLaunchConfig();

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

    extensionContext.workspaceState.update(
      CUSTOM_APPLICATION_ROOTS_KEY,
      newCustomApplicationRoots
    ) ?? [];

    this.eventEmitter.emit("applicationRootsChanged");
  }

  async getAvailableApplicationRoots() {
    const workspacePath = workspace.workspaceFolders![0].uri.fsPath;
    const applicationRootsCandidates = (await findAppRootCandidates()).map((candidate) => {
      return "./" + path.relative(workspacePath, candidate);
    });
    const customApplicationRoots =
      extensionContext.workspaceState.get<string[] | undefined>(CUSTOM_APPLICATION_ROOTS_KEY) ?? [];

    const applicationRoots = [...applicationRootsCandidates, ...customApplicationRoots];

    if (!applicationRoots) {
      Logger.debug(`Could not find any application roots.`);
      return [];
    }

    return applicationRoots;
  }

  async getAvailableXcodeSchemes() {
    const appRootFolder = getAppRootFolder();
    const sourceDir = getIosSourceDir(appRootFolder);

    const xcodeProject = await findXcodeProject(appRootFolder);

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
