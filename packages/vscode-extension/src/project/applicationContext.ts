import { Disposable, window } from "vscode";
import { BuildCache, migrateOldBuildCachesToNewStorage } from "../builders/BuildCache";
import { DependencyManager } from "../dependency/DependencyManager";
import { Logger } from "../Logger";
import { LaunchConfigController } from "../panels/LaunchConfigController";
import { findAppRootFolder } from "../utilities/extensionContext";
import { Platform } from "../utilities/platform";
import { setupPathEnv } from "../utilities/subprocess";

export class ApplicationContext implements Disposable {
  public appRootFolder: string;
  public dependencyManager: DependencyManager;
  public launchConfig: LaunchConfigController;
  public buildCache: BuildCache;
  private disposables: Disposable[] = [];

  constructor() {
    const newAppRoot = findAppRootFolder();
    if (!newAppRoot) {
      window.showErrorMessage(
        "Failed to determine any application root candidates, you can set it up manually in launch configuration",
        "Dismiss"
      );
      Logger.error("[Project] The application root could not be found.");
      throw Error(
        "Couldn't find app root folder. The extension should not be activated without reachable app root."
      );
    }

    Logger.info(`Found app root folder: ${newAppRoot}`);
    migrateOldBuildCachesToNewStorage(newAppRoot);

    this.appRootFolder = newAppRoot;

    if (Platform.OS === "macos") {
      try {
        setupPathEnv(newAppRoot);
      } catch (error) {
        window.showWarningMessage(
          "Error when setting up PATH environment variable, RN IDE may not work correctly.",
          "Dismiss"
        );
      }
    }

    this.dependencyManager = new DependencyManager(newAppRoot);

    this.launchConfig = new LaunchConfigController(newAppRoot);

    this.buildCache = new BuildCache(newAppRoot);

    this.disposables.push(this.launchConfig, this.dependencyManager);
  }

  public dispose() {
    this.disposables.forEach((disposable) => {
      disposable.dispose();
    });
  }
}
