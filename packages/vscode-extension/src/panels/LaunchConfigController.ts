import { ConfigurationChangeEvent, workspace, Disposable } from "vscode";
import { EventEmitter } from "stream";
import {
  LaunchConfig,
  LaunchConfigEventListener,
  LaunchConfigEventMap,
  LaunchConfigurationOptions,
} from "../common/LaunchConfig";
import { getAppRootFolder } from "../utilities/extensionContext";
import { findXcodeProject, findXcodeScheme } from "../utilities/xcode";
import { Logger } from "../Logger";
import { getIosSourceDir } from "../builders/buildIOS";

export class LaunchConfigController implements Disposable, LaunchConfig {
  private config: LaunchConfigurationOptions;
  private eventEmitter = new EventEmitter();
  private configListener: Disposable | undefined;

  constructor() {
    const getCurrentConfig = () => {
      const launchConfiguration = workspace.getConfiguration(
        "launch",
        workspace.workspaceFolders![0].uri
      );

      const configurations = launchConfiguration.get<Array<any>>("configurations")!;

      const RNIDEConfiguration = configurations.find((config) => {
        return config.type === "react-native-ide";
      });

      const { android, appRoot, ios, isExpo, metroConfigPath, env, ...rest } = RNIDEConfiguration;

      return (
        ({ android, appRoot, ios, isExpo, metroConfigPath, env } as LaunchConfigurationOptions) ??
        {}
      );
    };

    this.config = getCurrentConfig();

    this.configListener = workspace.onDidChangeConfiguration((event: ConfigurationChangeEvent) => {
      if (!event.affectsConfiguration("launch")) {
        return;
      }

      this.config = getCurrentConfig();

      this.eventEmitter.emit("launchConfigChange", this.config);
    });
  }

  async getConfig() {
    return this.config;
  }

  async update<K extends keyof LaunchConfigurationOptions>(
    key: K,
    value: LaunchConfigurationOptions[K]
  ) {
    const configurations = workspace.getConfiguration("launch");

    const newLaunchConfig = { ...this.config, [key]: value };

    const oldConfigurations = configurations.get<Array<any>>("configurations");

    const newConfigurations = oldConfigurations?.map((configuration) => {
      if (configuration.type !== "react-native-ide") {
        return configuration;
      }
      return { ...configuration, ...newLaunchConfig };
    });

    await configurations.update("configurations", newConfigurations);
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
    this.configListener?.dispose();
  }
}
