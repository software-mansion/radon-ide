import path from "path";
import { Disposable, workspace } from "vscode";
import { loadProjectEnv } from "@expo/env";
import _ from "lodash";
import semver, { SemVer } from "semver";
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
import { DevtoolsServer, WebSocketDevtoolsServer } from "./devtools";
import { setupPathEnv } from "../utilities/subprocess";

/**
 * Represents a launch configuration that has been resolved with additional properties.
 */
export type ResolvedLaunchConfig = LaunchOptions & {
  absoluteAppRoot: string;
  preview: {
    waitForAppLaunch: boolean;
  };
  env: Record<string, string>;
  usePrebuild?: boolean;
  useOldDevtools: boolean;
};

function getReactNativeVersion(appRoot: string): SemVer | null {
  try {
    const reactNativePackage = requireNoCache("react-native/package.json", {
      paths: [appRoot],
    });
    const installedReactNativeVersion = new SemVer(reactNativePackage.version);
    return installedReactNativeVersion;
  } catch {}
  try {
    const appPackage = requireNoCache("./package.json", {
      paths: [appRoot],
    });
    const reactNativeDependencyVersion = semver.coerce(appPackage.dependencies["react-native"]);
    return reactNativeDependencyVersion;
  } catch {}
  return null;
}

function checkFuseboxSupport(appRoot: string): boolean {
  const reactNativeVersion = getReactNativeVersion(appRoot);
  if (reactNativeVersion === null) {
    Logger.error(
      "Couldn't read react-native version for project. Defaulting to no fusebox support."
    );
    return false;
  }
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
    usePrebuild: configuration.usePrebuild,
    useOldDevtools: configuration.useOldDevtools ?? !checkFuseboxSupport(absoluteAppRoot),
  };
}

function createMetroProvider(launchConfig: ResolvedLaunchConfig, devtoolsPort?: Promise<number>) {
  if (launchConfig.metroPort) {
    return new SharedMetroProvider(launchConfig, devtoolsPort);
  }
  return new UniqueMetroProvider(launchConfig, devtoolsPort);
}

export class ApplicationContext implements Disposable {
  public applicationDependencyManager: ApplicationDependencyManager;
  public buildManager: BuildManager;
  public launchConfig: ResolvedLaunchConfig;
  public reactNativeVersion: SemVer | null;
  public readonly buildCache: BuildCache;
  private _metroProvider: MetroProvider & Partial<Disposable>;
  private _devtoolsServer: Promise<WebSocketDevtoolsServer> | undefined;
  private disposables: Disposable[] = [];

  public get metroProvider(): MetroProvider {
    return this._metroProvider;
  }

  public get devtoolsServer(): Promise<DevtoolsServer & { port: number }> | undefined {
    return this._devtoolsServer;
  }

  constructor(
    private readonly stateManager: StateManager<ApplicationContextState>,
    public readonly workspaceConfigState: StateManager<WorkspaceConfiguration>, // owned by `Project`, do not dispose
    launchConfig: LaunchConfiguration,
    fingerprintProvider: FingerprintProvider
  ) {
    this.buildCache = new BuildCache();
    this.launchConfig = resolveLaunchConfig(launchConfig);
    setupPathEnv(this.launchConfig.absoluteAppRoot);
    this.reactNativeVersion = getReactNativeVersion(this.launchConfig.absoluteAppRoot);
    this.applicationDependencyManager = new ApplicationDependencyManager(
      this.stateManager.getDerived("applicationDependencies"),
      this.launchConfig,
      fingerprintProvider
    );
    const buildManager = new BatchingBuildManager(
      new BuildManagerImpl(this.buildCache, fingerprintProvider)
    );
    this.buildManager = buildManager;
    if (this.launchConfig.useOldDevtools) {
      this._devtoolsServer = WebSocketDevtoolsServer.createServer();
    }
    this._metroProvider = createMetroProvider(
      this.launchConfig,
      this.devtoolsServer?.then((server) => server.port)
    );

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
    setupPathEnv(this.launchConfig.absoluteAppRoot);
    this.reactNativeVersion = getReactNativeVersion(this.launchConfig.absoluteAppRoot);
    this.applicationDependencyManager.setLaunchConfiguration(this.launchConfig);
    await this.applicationDependencyManager.runAllDependencyChecks();

    this._devtoolsServer?.then((server) => server.dispose());
    this._devtoolsServer = undefined;

    if (this.launchConfig.useOldDevtools) {
      this._devtoolsServer = WebSocketDevtoolsServer.createServer();
    }

    this._metroProvider.dispose?.();
    this._metroProvider = createMetroProvider(
      this.launchConfig,
      this.devtoolsServer?.then((server) => server.port)
    );
  }

  public dispose() {
    disposeAll(this.disposables);
    this._metroProvider.dispose?.();
    this._devtoolsServer?.then((server) => server.dispose());
  }
}
