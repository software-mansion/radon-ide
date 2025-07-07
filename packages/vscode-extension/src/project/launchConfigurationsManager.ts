import path from "path";
import { ConfigurationChangeEvent, Disposable, EventEmitter, workspace } from "vscode";
import vscode from "vscode";
import { LaunchConfiguration, LaunchConfigurationOptions } from "../common/LaunchConfig";
import { Logger } from "../Logger";
import { findAppRootCandidates } from "../utilities/extensionContext";
import { getLaunchConfigurations } from "../utilities/launchConfiguration";

function findDefaultAppRoot(showWarning = false) {
  const appRoots = findAppRootCandidates();
  const defaultAppRoot = appRoots.length > 0 ? appRoots[0] : undefined;
  if (appRoots.length > 0 && showWarning) {
    vscode.window
      .showWarningMessage(
        "Multiple application roots found in workspace, but no 'appRoot' specified in launch configuration. Using the first found application root: " +
          defaultAppRoot,
        "Add Launch Configuration"
      )
      .then((selection) => {
        if (selection === "Add Launch Configuration") {
          vscode.commands.executeCommand("debug.addConfiguration");
        }
      });
  }
  return defaultAppRoot;
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
    if (this._launchConfigurations.length > 0) {
      return this._launchConfigurations[0];
    }
    return launchConfigFromOptionsWithDefaultAppRoot({}, findDefaultAppRoot(true));
  }

  dispose() {
    this.watchWorkspaceConfiguration.dispose();
    this.launchConfigurationsChangedEventEmitter.dispose();
  }
}
