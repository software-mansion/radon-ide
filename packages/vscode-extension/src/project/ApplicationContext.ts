import { Disposable } from "vscode";
import { BuildCache } from "../builders/BuildCache";
import { DependencyManager } from "../dependency/DependencyManager";
import { disposeAll } from "../utilities/disposables";
import { BuildManagerImpl, BuildManager } from "../builders/BuildManager";
import { BatchingBuildManager } from "../builders/BatchingBuildManager";
import { LaunchConfiguration } from "../common/LaunchConfig";
import { OutputChannelRegistry } from "./OutputChannelRegistry";

function createBuildManager(
  dependencyManager: DependencyManager,
  buildCache: BuildCache,
  outputChannelRegistry: OutputChannelRegistry
) {
  return new BatchingBuildManager(
    new BuildManagerImpl(dependencyManager, buildCache, outputChannelRegistry)
  );
}

export class ApplicationContext implements Disposable {
  public dependencyManager: DependencyManager;
  public buildManager: BuildManager;
  private disposables: Disposable[] = [];

  constructor(
    public launchConfig: LaunchConfiguration,
    public readonly buildCache: BuildCache,
    private readonly outputChannelRegistry: OutputChannelRegistry
  ) {
    this.dependencyManager = new DependencyManager(this.launchConfig);
    const buildManager = createBuildManager(
      this.dependencyManager,
      this.buildCache,
      this.outputChannelRegistry
    );
    this.buildManager = buildManager;

    this.disposables.push(this.dependencyManager, buildManager);
  }

  public get appRootFolder(): string {
    return this.launchConfig.absoluteAppRoot;
  }

  public async updateLaunchConfig(launchConfig: LaunchConfiguration) {
    const oldAppRoot = this.appRootFolder;
    this.launchConfig = launchConfig;
    this.dependencyManager.setLaunchConfiguration(launchConfig);
    await this.dependencyManager.runAllDependencyChecks();
    if (this.appRootFolder !== oldAppRoot) {
      this.updateAppRootFolder();
    }
  }

  public async updateAppRootFolder() {
    disposeAll(this.disposables);
    const buildManager = createBuildManager(
      this.dependencyManager,
      this.buildCache,
      this.outputChannelRegistry
    );
    this.buildManager = buildManager;
    this.disposables.push(this.dependencyManager, buildManager);
  }

  public dispose() {
    disposeAll(this.disposables);
  }
}
