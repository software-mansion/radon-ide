import { Disposable } from "vscode";
import { BuildCache } from "../builders/BuildCache";
import { DependencyManager } from "../dependency/DependencyManager";
import { LaunchConfigController } from "../panels/LaunchConfigController";
import { disposeAll } from "../utilities/disposables";
import { BuildManagerImpl, BuildManager } from "../builders/BuildManager";
import { BatchingBuildManager } from "../builders/BatchingBuildManager";

function createBuildManager(dependencyManager: DependencyManager, buildCache: BuildCache) {
  return new BatchingBuildManager(new BuildManagerImpl(dependencyManager, buildCache));
}

export class ApplicationContext implements Disposable {
  public dependencyManager: DependencyManager;
  public launchConfig: LaunchConfigController;
  public buildManager: BuildManager;
  private disposables: Disposable[] = [];

  constructor(
    public appRootFolder: string,
    public readonly buildCache: BuildCache
  ) {
    this.dependencyManager = new DependencyManager(appRootFolder);

    this.launchConfig = new LaunchConfigController(appRootFolder);
    const buildManager = createBuildManager(this.dependencyManager, this.buildCache);
    this.buildManager = buildManager;

    this.disposables.push(this.launchConfig, this.dependencyManager, buildManager);
  }

  public async updateAppRootFolder(newAppRoot: string) {
    if (this.appRootFolder === newAppRoot) {
      return;
    }

    this.appRootFolder = newAppRoot;
    this.dependencyManager.appRootFolder = newAppRoot;

    await this.dependencyManager.runAllDependencyChecks();

    disposeAll(this.disposables);

    this.launchConfig = new LaunchConfigController(newAppRoot);
    const buildManager = createBuildManager(this.dependencyManager, this.buildCache);
    this.buildManager = buildManager;

    this.disposables.push(this.launchConfig, this.dependencyManager, buildManager);
  }

  public dispose() {
    disposeAll(this.disposables);
  }
}
