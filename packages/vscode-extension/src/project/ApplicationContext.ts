import path from "path";
import { Disposable, workspace } from "vscode";
import { BuildCache } from "../builders/BuildCache";
import { DependencyManager } from "../dependency/DependencyManager";
import { LaunchConfigController } from "../panels/LaunchConfigController";
import { disposeAll } from "../utilities/disposables";
import { BuildManagerImpl, BuildManager } from "../builders/BuildManager";
import { BatchingBuildManager } from "../builders/BatchingBuildManager";
import { LaunchConfiguration } from "../common/LaunchConfig";

function createBuildManager(dependencyManager: DependencyManager, buildCache: BuildCache) {
  return new BatchingBuildManager(new BuildManagerImpl(dependencyManager, buildCache));
}

export class ApplicationContext implements Disposable {
  public dependencyManager: DependencyManager;
  public launchConfigurationController: LaunchConfigController;
  public buildManager: BuildManager;
  private disposables: Disposable[] = [];

  constructor(
    public launchConfig: LaunchConfiguration,
    public readonly buildCache: BuildCache
  ) {
    this.dependencyManager = new DependencyManager(this.appRootFolder);
    this.launchConfigurationController = new LaunchConfigController(this.appRootFolder);
    const buildManager = createBuildManager(this.dependencyManager, this.buildCache);
    this.buildManager = buildManager;

    this.disposables.push(this.launchConfigurationController, this.dependencyManager, buildManager);
  }

  public get appRootFolder(): string {
    return path.resolve(workspace.workspaceFolders![0].uri.fsPath, this.launchConfig.appRoot);
  }

  public async updateLaunchConfig(launchConfig: LaunchConfiguration) {
    const oldAppRoot = this.appRootFolder;
    this.launchConfig = launchConfig;
    if (this.appRootFolder !== oldAppRoot) {
      this.updateAppRootFolder();
    }
  }

  public async updateAppRootFolder() {
    const newAppRoot = this.appRootFolder;
    this.dependencyManager.appRootFolder = newAppRoot;

    await this.dependencyManager.runAllDependencyChecks();

    disposeAll(this.disposables);

    this.launchConfigurationController = new LaunchConfigController(newAppRoot);
    const buildManager = createBuildManager(this.dependencyManager, this.buildCache);
    this.buildManager = buildManager;

    this.disposables.push(this.launchConfigurationController, this.dependencyManager, buildManager);
  }

  public dispose() {
    disposeAll(this.disposables);
  }
}
