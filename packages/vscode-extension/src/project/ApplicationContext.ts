import { Disposable } from "vscode";
import { BuildCache } from "../builders/BuildCache";
import { DependencyManager } from "../dependency/DependencyManager";
import { LaunchConfigController } from "../panels/LaunchConfigController";
import { disposeAll } from "../utilities/disposables";

export class ApplicationContext implements Disposable {
  public dependencyManager: DependencyManager;
  public launchConfig: LaunchConfigController;
  public buildCache: BuildCache;
  private disposables: Disposable[] = [];

  constructor(public appRootFolder: string) {
    this.dependencyManager = new DependencyManager(appRootFolder);

    this.launchConfig = new LaunchConfigController(appRootFolder);
    this.buildCache = new BuildCache(appRootFolder);

    this.disposables.push(this.launchConfig, this.dependencyManager);
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
    this.buildCache = new BuildCache(newAppRoot);
    this.disposables.push(this.launchConfig, this.dependencyManager);
  }

  public dispose() {
    disposeAll(this.disposables);
  }
}
