import path from "path";
import { Disposable, workspace } from "vscode";
import { BuildCache } from "../builders/BuildCache";
import { DependencyManager } from "../dependency/DependencyManager";
import { disposeAll } from "../utilities/disposables";
import { BuildManagerImpl, BuildManager } from "../builders/BuildManager";
import { BatchingBuildManager } from "../builders/BatchingBuildManager";
import { LaunchConfiguration } from "../common/LaunchConfig";

export type ResolvedLaunchConfig = LaunchConfiguration & {
  absoluteAppRoot: string;
  preview: {
    waitForAppLaunch: boolean;
  };
};

function resolveLaunchConfig(configuration: LaunchConfiguration): ResolvedLaunchConfig {
  const appRoot = configuration.appRoot;
  const absoluteAppRoot = path.resolve(workspace.workspaceFolders![0].uri.fsPath, appRoot);
  return {
    ...configuration,
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
