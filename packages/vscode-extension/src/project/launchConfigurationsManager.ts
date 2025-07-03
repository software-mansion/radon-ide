import { ConfigurationChangeEvent, Disposable, EventEmitter, workspace } from "vscode";
import { LaunchConfiguration } from "../common/LaunchConfig";
import { Logger } from "../Logger";
import { findAppRootCandidates } from "../utilities/extensionContext";
import { getLaunchConfigurations } from "../utilities/launchConfiguration";

function createLaunchConfigs() {
  const launchConfigOptions = getLaunchConfigurations();
  const appRoots = findAppRootCandidates();
  const defaultAppRoot = appRoots.length > 0 ? appRoots[0] : undefined;
  if (appRoots.length > 0) {
    // TODO: warning?
  }
  const launchConfigurations = launchConfigOptions.flatMap<LaunchConfiguration>((config) => {
    if ((config.appRoot ?? defaultAppRoot) === undefined) {
      Logger.warn(
        "No app root found. Please specify 'appRoot' in your launch configuration or ensure your workspace contains a valid React Native or Expo project."
      );
      return [];
    }
    const appRoot = (config.appRoot ?? defaultAppRoot) as string;
    return [
      {
        appRoot,
        env: {},
        preview: {
          waitForAppLaunch: true,
        },
        ...config,
      },
    ];
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

  dispose() {
    this.watchWorkspaceConfiguration.dispose();
    this.launchConfigurationsChangedEventEmitter.dispose();
  }
}
