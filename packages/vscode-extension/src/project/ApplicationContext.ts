import path from "path";
import { Disposable, workspace } from "vscode";
import { loadProjectEnv } from "@expo/env";
import _ from "lodash";
import { BuildCache } from "../builders/BuildCache";
import { DependencyManager } from "../dependency/DependencyManager";
import { disposeAll } from "../utilities/disposables";
import { BuildManagerImpl, BuildManager } from "../builders/BuildManager";
import { BatchingBuildManager } from "../builders/BatchingBuildManager";
import { LaunchConfiguration, LaunchOptions } from "../common/LaunchConfig";
import { Logger } from "../Logger";

/**
 * Represents a launch configuration that has been resolved with additional properties.
 */
export type ResolvedLaunchConfig = LaunchOptions & {
  absoluteAppRoot: string;
  preview: {
    waitForAppLaunch: boolean;
  };
  env: Record<string, string>;
};

function resolveEnvironment(
  appRoot: string,
  configuredEnv: Record<string, string>
): Record<string, string> {
  const systemEnv = process.env as NodeJS.ProcessEnv;
  const mergedEnv = { ...systemEnv, ...configuredEnv };
  // load the dotenv files for the project into `mergedEnv`
  const loadEnvResult = loadProjectEnv(appRoot, { force: true, systemEnv: mergedEnv });

  if (loadEnvResult.result === "loaded") {
    Logger.info(
      `Project in "${appRoot}" loaded environment variables from .env files:`,
      loadEnvResult.files
    );
  }

  // filter out any `undefined` values from the environment variables
  const env = _.pickBy(mergedEnv, _.isString);
  return env;
}

function resolveLaunchConfig(configuration: LaunchConfiguration): ResolvedLaunchConfig {
  const appRoot = configuration.appRoot;
  const absoluteAppRoot = path.resolve(workspace.workspaceFolders![0].uri.fsPath, appRoot);

  const configuredEnv = configuration.env || {};

  return {
    ...configuration,
    get env() {
      return resolveEnvironment(absoluteAppRoot, configuredEnv);
    },
    absoluteAppRoot,
    preview: {
      waitForAppLaunch: configuration.preview?.waitForAppLaunch ?? true,
    },
  };
}

export class ApplicationContext implements Disposable {
  public dependencyManager: DependencyManager;
  public buildManager: BuildManager;
  public launchConfig: ResolvedLaunchConfig;
  private disposables: Disposable[] = [];

  constructor(
    launchConfig: LaunchConfiguration,
    public readonly buildCache: BuildCache
  ) {
    this.launchConfig = resolveLaunchConfig(launchConfig);
    this.dependencyManager = new DependencyManager(this.launchConfig);
    const buildManager = new BatchingBuildManager(new BuildManagerImpl(buildCache));
    this.buildManager = buildManager;

    this.disposables.push(this.dependencyManager, buildManager);
  }

  public get appRootFolder(): string {
    return this.launchConfig.absoluteAppRoot;
  }

  public async updateLaunchConfig(launchConfig: LaunchConfiguration) {
    this.launchConfig = resolveLaunchConfig(launchConfig);
    this.dependencyManager.setLaunchConfiguration(this.launchConfig);
    await this.dependencyManager.runAllDependencyChecks();
  }

  public dispose() {
    disposeAll(this.disposables);
  }
}
