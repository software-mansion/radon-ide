import { Webview, Disposable } from "vscode";
import { Logger } from "../Logger";
import { installNodeModulesAsync, resolvePackageManager } from "../utilities/packageManager";
import { DependencyChecker } from "./DependencyChecker";
import { command } from "../utilities/subprocess";
import { getIosSourceDir } from "../builders/buildIOS";
import { getAppRootFolder } from "../utilities/extensionContext";

export class DependencyInstaller implements Disposable {
  private webview: Webview;
  private dependencyChecker: DependencyChecker;
  private disposables: Disposable[] = [];

  constructor(webview: Webview) {
    this.webview = webview;
    this.dependencyChecker = new DependencyChecker(webview);
  }

  public dispose() {
    // Dispose of all disposables (i.e. commands) for the current webview panel
    while (this.disposables.length) {
      const disposable = this.disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }

  public setWebviewMessageListener() {
    Logger.debug("Setup dependency installer listeners.");
    this.webview.onDidReceiveMessage(
      (message: any) => {
        const command = message.command;

        switch (command) {
          case "installNodeModules":
            Logger.debug("Received installNodeModules command.");
            this.installNodeModules();
            return;
          case "installPods":
            Logger.debug("Received installPods command.");
            this.installPods();
            return;
        }
      },
      undefined,
      this.disposables
    );
  }

  public async installNodeModules() {
    const packageManager = await resolvePackageManager();
    Logger.debug(`Installing node modules using ${packageManager}`);
    this.webview.postMessage({
      command: "installingNodeModules",
    });

    await installNodeModulesAsync(packageManager);
    Logger.debug("Finished installing node modules!");
    await this.dependencyChecker.checkNodeModulesInstalled();
    // after installing node modules, we need to run checkPodsInstalled function to determine if pods can be installed (they can't be installed if node modules are not present)
    await this.dependencyChecker.checkPodsInstalled();
  }

  public async installPods() {
    Logger.debug("Installing pods");
    this.webview.postMessage({
      command: "installingPods",
    });
    try{
      await installIOSDependencies(getAppRootFolder(), false);
      Logger.debug("Finished installing pods!");
    }catch (error){
      Logger.error("", error);
    }
    await this.dependencyChecker.checkPodsInstalled();
  }
}

export function installIOSDependencies(appRootFolder: string, forceCleanBuild: boolean) {
  const iosDirPath = getIosSourceDir(appRootFolder);

  if (!iosDirPath) {
    throw new Error(`ios directory was not found inside the workspace.`);
  }

  // TODO: support forceCleanBuild option and wipe pods prior to installing
  return command("pod install", {
    cwd: iosDirPath,
    env: {
      ...process.env,
      LANG: "en_US.UTF-8",
    },
  });
}
