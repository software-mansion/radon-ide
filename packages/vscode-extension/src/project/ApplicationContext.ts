import path from "path";
import { Disposable, workspace } from "vscode";
import { loadProjectEnv } from "@expo/env";
import _ from "lodash";
import { BuildCache } from "../builders/BuildCache";
import { disposeAll } from "../utilities/disposables";
import { BuildManagerImpl, BuildManager } from "../builders/BuildManager";
import { BatchingBuildManager } from "../builders/BatchingBuildManager";
import { LaunchConfiguration, LaunchOptions } from "../common/LaunchConfig";
import { StateManager } from "./StateManager";
import { ApplicationContextState, WorkspaceConfiguration } from "../common/State";
import { ApplicationDependencyManager } from "../dependency/ApplicationDependencyManager";
import { Logger } from "../Logger";
import { FingerprintProvider } from "./FingerprintProvider";

/**
 * Represents a launch configuration that has been resolved with additional properties.
 */
export type ResolvedLaunchConfig = LaunchOptions & {
  absoluteAppRoot: string;
  preview: {
    waitForAppLaunch: boolean;
  };
  env: Record<string, string>;
  usePrebuild: boolean;
};

function resolveLaunchConfig(configuration: LaunchConfiguration): ResolvedLaunchConfig {
  const appRoot = configuration.appRoot;
  const absoluteAppRoot = path.resolve(workspace.workspaceFolders![0].uri.fsPath, appRoot);

  const configuredEnv = configuration.env || {};

  let lastLoadedEnvFiles: string[] | undefined;

  function resolveEnvironment(): Record<string, string> {
    const systemEnv = process.env as NodeJS.ProcessEnv;
    const mergedEnv = { ...systemEnv, ...configuredEnv };
    // load the dotenv files for the project into `mergedEnv`
    const loadEnvResult = loadProjectEnv(absoluteAppRoot, {
      silent: true,
      force: true,
      systemEnv: mergedEnv,
    });

    if (loadEnvResult.result !== "loaded") {
      return configuredEnv;
    }

    if (!_.isEqual(loadEnvResult.files, lastLoadedEnvFiles)) {
      lastLoadedEnvFiles = loadEnvResult.files;
      Logger.info(
        `Project in "${appRoot}" loaded environment variables from .env files:`,
        loadEnvResult.files
      );
    }

    const env = { ...loadEnvResult.env, ...configuredEnv };
    return env;
  }

  return {
    ...configuration,
    get env() {
      return resolveEnvironment();
    },
    absoluteAppRoot,
    preview: {
      waitForAppLaunch: configuration.preview?.waitForAppLaunch ?? true,
    },
    usePrebuild: configuration.usePrebuild ?? false,
  };
}

export class ApplicationContext implements Disposable {
  public applicationDependencyManager: ApplicationDependencyManager;
  public buildManager: BuildManager;
  public launchConfig: ResolvedLaunchConfig;
  public readonly buildCache: BuildCache;
  private disposables: Disposable[] = [];

  constructor(
    private readonly stateManager: StateManager<ApplicationContextState>,
    public readonly workspaceConfigState: StateManager<WorkspaceConfiguration>, // owned by `Project`, do not dispose
    launchConfig: LaunchConfiguration,
    fingerprintProvider: FingerprintProvider
  ) {
    this.buildCache = new BuildCache();
    this.launchConfig = resolveLaunchConfig(launchConfig);
    this.applicationDependencyManager = new ApplicationDependencyManager(
      this.stateManager.getDerived("applicationDependencies"),
      this.launchConfig,
      fingerprintProvider
    );
    const buildManager = new BatchingBuildManager(
      new BuildManagerImpl(this.buildCache, fingerprintProvider)
    );
    this.buildManager = buildManager;

    this.disposables.push(this.applicationDependencyManager, buildManager);
  }

  public get workspaceConfiguration(): WorkspaceConfiguration {
    return this.workspaceConfigState.getState();
  }

  public get appRootFolder(): string {
    return this.launchConfig.absoluteAppRoot;
  }

  public async updateLaunchConfig(launchConfig: LaunchConfiguration) {
    this.launchConfig = resolveLaunchConfig(launchConfig);
    this.applicationDependencyManager.setLaunchConfiguration(this.launchConfig);
    await this.applicationDependencyManager.runAllDependencyChecks();
  }

  public dispose() {
    disposeAll(this.disposables);
  }
}
