import path from "path";
import { Disposable, workspace } from "vscode";
import { loadProjectEnv } from "@expo/env";
import _ from "lodash";
import { SemVer } from "semver";
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
import { requireNoCache } from "../utilities/requireNoCache";
import { MetroProvider, SharedMetroProvider, UniqueMetroProvider } from "./metro";

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
  useOldDevtools: boolean;
};

function checkFuseboxSupport(appRoot: string): boolean {
  const reactNativePackage = requireNoCache("react-native/package.json", {
    paths: [appRoot],
  });
  const reactNativeVersion = new SemVer(reactNativePackage.version);
  const supportsFusebox = reactNativeVersion.compare("0.76.0") >= 0;
  return supportsFusebox;
}

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
    useOldDevtools: configuration.useOldDevtools ?? !checkFuseboxSupport(absoluteAppRoot),
  };
}

function createMetroProvider(launchConfig: ResolvedLaunchConfig) {
  if (launchConfig.metroPort) {
    return new SharedMetroProvider(launchConfig, undefined, []);
  }
  return new UniqueMetroProvider(launchConfig, undefined, []);
}

export class ApplicationContext implements Disposable {
  public applicationDependencyManager: ApplicationDependencyManager;
  public buildManager: BuildManager;
  public launchConfig: ResolvedLaunchConfig;
  public readonly buildCache: BuildCache;
  private _metroProvider: MetroProvider & Partial<Disposable>;
  private disposables: Disposable[] = [];

  public get metroProvider(): MetroProvider {
    return this._metroProvider;
  }

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
    this._metroProvider = createMetroProvider(this.launchConfig);

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
    this._metroProvider.dispose?.();
    this._metroProvider = createMetroProvider(this.launchConfig);
  }

  public dispose() {
    disposeAll(this.disposables);
    this._metroProvider.dispose?.();
  }
}
