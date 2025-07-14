import path from "path";
import { ConfigurationChangeEvent, Disposable, EventEmitter, workspace } from "vscode";
import vscode from "vscode";
import _ from "lodash";
import { LaunchConfiguration, LaunchConfigurationOptions } from "../common/LaunchConfig";
import { Logger } from "../Logger";
import { extensionContext, findAppRootCandidates } from "../utilities/extensionContext";
import { getLaunchConfigurations } from "../utilities/launchConfiguration";
const INITIAL_LAUNCH_CONFIGURATION_KEY = "initialLaunchConfiguration";

function findDefaultAppRoot(showWarning = false) {
  const appRoots = findAppRootCandidates();
  const workspacePath = workspace.workspaceFolders![0].uri.fsPath;
  const defaultAppRoot = appRoots.length > 0 ? appRoots[0] : undefined;
  const defaultAppRootRelative =
    defaultAppRoot && "./" + path.relative(workspacePath, defaultAppRoot);
  if (appRoots.length > 1 && showWarning) {
    vscode.window
      .showWarningMessage(
        "Multiple application roots found in workspace, but no 'appRoot' specified in launch configuration. Using the first found application root: " +
          defaultAppRootRelative,
        "Add Launch Configuration"
      )
      .then((selection) => {
        if (selection === "Add Launch Configuration") {
          vscode.commands.executeCommand("debug.addConfiguration");
        }
      });
  }
  return defaultAppRootRelative;
}

export function launchConfigurationFromOptions(
  options: LaunchConfigurationOptions
): LaunchConfiguration {
  return launchConfigFromOptionsWithDefaultAppRoot(options, findDefaultAppRoot());
}

function launchConfigFromOptionsWithDefaultAppRoot(
  options: LaunchConfigurationOptions,
  defaultAppRoot: string | undefined
): LaunchConfiguration {
  if ((options.appRoot ?? defaultAppRoot) === undefined) {
    const maybeName =
      options.name === undefined ? "" : ` for launch configuration "${options.name}"`;
    throw new Error(
      `No app root found${maybeName}.` +
        ` Please specify 'appRoot' in your launch configuration or ensure your workspace contains a valid React Native or Expo project.`
    );
  }
  const appRoot = (options.appRoot ?? defaultAppRoot) as string;
  const absoluteAppRoot = path.resolve(workspace.workspaceFolders![0].uri.fsPath, appRoot);
  return {
    appRoot,
    absoluteAppRoot,
    env: {},
    ...options,
    preview: {
      waitForAppLaunch: options.preview?.waitForAppLaunch ?? true,
    },
  };
}

function createLaunchConfigs() {
  const launchConfigOptions = getLaunchConfigurations();
  const defaultAppRoot = findDefaultAppRoot();
  const launchConfigurations = launchConfigOptions.flatMap<LaunchConfiguration>((config) => {
    try {
      return [launchConfigFromOptionsWithDefaultAppRoot(config, defaultAppRoot)];
    } catch (error) {
      const message = (error as Error).message;
      Logger.warn(message);
      return [];
    }
  });
  return launchConfigurations;
}

export class LaunchConfigurationsManager implements Disposable {
  private _launchConfigurations: Array<LaunchConfiguration> = [];
  private readonly watchWorkspaceConfiguration: Disposable;
  private readonly launchConfigurationsChangedEventEmitter = new EventEmitter<
    Array<LaunchConfiguration>
  >();
  public readonly onLaunchConfigurationsChanged =
    this.launchConfigurationsChangedEventEmitter.event;

  constructor() {
    this._launchConfigurations = createLaunchConfigs();
    this.watchWorkspaceConfiguration = workspace.onDidChangeConfiguration(
      (event: ConfigurationChangeEvent) => {
        if (event.affectsConfiguration("launch")) {
          this._launchConfigurations = createLaunchConfigs();
          this.launchConfigurationsChangedEventEmitter.fire(this.launchConfigurations);
        }
      }
    );
  }

  public get launchConfigurations(): Array<LaunchConfiguration> {
    return this._launchConfigurations.slice();
  }

  public get initialLaunchConfiguration(): LaunchConfiguration {
    const workspaceState = extensionContext.workspaceState;
    const savedLaunchConfig = workspaceState.get<LaunchConfiguration | undefined>(
      INITIAL_LAUNCH_CONFIGURATION_KEY
    );
    if (
      savedLaunchConfig &&
      this._launchConfigurations.find((config) => _.isEqual(config, savedLaunchConfig))
    ) {
      // If the saved launch config is still valid, return it
      return savedLaunchConfig;
    }
    // Otherwise, return the first launch config or a default one
    if (this._launchConfigurations.length > 0) {
      return this._launchConfigurations[0];
    }
    return launchConfigFromOptionsWithDefaultAppRoot({}, findDefaultAppRoot(true));
  }

  public async createOrUpdateLaunchConfiguration(
    newLaunchConfiguration: LaunchConfigurationOptions | undefined,
    oldLaunchConfiguration?: LaunchConfiguration
  ): Promise<LaunchConfiguration | undefined> {
    const newConfig = newLaunchConfiguration
      ? {
          name: "Radon IDE panel",
          type: "radon-ide",
          request: "launch",
          ...newLaunchConfiguration,
        }
      : undefined;
    const defaultAppRoot = findDefaultAppRoot();
    const launchConfig = workspace.getConfiguration("launch");
    const configurations = launchConfig.get<Array<Record<string, unknown>>>("configurations") ?? [];
    const oldConfigIndex =
      oldLaunchConfiguration !== undefined
        ? configurations.findIndex((config) => {
            const fullConfig = launchConfigFromOptionsWithDefaultAppRoot(config, defaultAppRoot);
            return _.isEqual(fullConfig, oldLaunchConfiguration);
          })
        : -1;
    if (oldConfigIndex !== -1) {
      if (newConfig === undefined) {
        configurations.splice(oldConfigIndex, 1);
      } else {
        configurations[oldConfigIndex] = newConfig;
      }
    } else if (newConfig !== undefined) {
      configurations.push(newConfig);
    } else {
      return;
    }
    await launchConfig.update("configurations", configurations);
    if (newConfig !== undefined) {
      return launchConfigFromOptionsWithDefaultAppRoot(newConfig, defaultAppRoot);
    }
  }

  public saveInitialLaunchConfig(launchConfig: LaunchConfiguration) {
    const workspaceState = extensionContext.workspaceState;
    workspaceState.update(INITIAL_LAUNCH_CONFIGURATION_KEY, launchConfig);
  }

  dispose() {
    this.watchWorkspaceConfiguration.dispose();
    this.launchConfigurationsChangedEventEmitter.dispose();
  }
}
