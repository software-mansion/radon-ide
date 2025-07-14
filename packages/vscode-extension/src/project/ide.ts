import { Disposable } from "vscode";
import { Project } from "./project";
import { DeviceManager } from "../devices/DeviceManager";
import { WorkspaceConfigController } from "../panels/WorkspaceConfigController";
import { Utils } from "../utilities/utils";
import { extensionContext } from "../utilities/extensionContext";
import { Logger } from "../Logger";
import { disposeAll } from "../utilities/disposables";
import { LaunchConfigurationOptions } from "../common/LaunchConfig";

interface InitialOptions {
  initialLaunchConfig?: LaunchConfigurationOptions;
}

export class IDE implements Disposable {
  private static instance: IDE | null = null;

  public readonly deviceManager: DeviceManager;
  public readonly project: Project;
  public readonly workspaceConfigController: WorkspaceConfigController;
  public readonly utils: Utils;
  private disposed = false;
  private disposables: Disposable[] = [];

  private attachSemaphore = 0;

  constructor({ initialLaunchConfig }: InitialOptions = {}) {
    this.deviceManager = new DeviceManager();
    this.utils = new Utils();
    this.project = new Project(this.deviceManager, this.utils, initialLaunchConfig);
    this.workspaceConfigController = new WorkspaceConfigController();

    this.disposables.push(this.project, this.workspaceConfigController);
    // register disposable with context
    extensionContext.subscriptions.push(this);
  }

  dispose() {
    if (!this.disposed) {
      if (this.attachSemaphore > 0) {
        Logger.error("IDE is being disposed while still attached");
      }
      if (IDE.instance === this) {
        IDE.instance = null;
      }
      Logger.debug("Disposing IDE instance");
      this.disposed = true;
      disposeAll(this.disposables);
    }
  }

  public detach() {
    this.attachSemaphore -= 1;
    if (this.attachSemaphore <= 0) {
      // we delay dispose to maintain IDE instance when the panel is moved between side panel or the editor tab
      // in such a case we first get the initial panel destroyed and only shortly after the new panel is created
      // we expect that the new panel will be created before the timeout is reached and therefore the IDE instance will be kept
      // but we also need to handle the scenario when someone closes in which case it is expected that we release all the
      // resources.
      setTimeout(() => {
        if (this.attachSemaphore <= 0) {
          this.dispose();
        }
      }, 1000);
    }
  }

  public static attach(): IDE {
    if (!IDE.instance) {
      IDE.instance = new IDE();
    }
    const ide = IDE.instance;
    ide.attachSemaphore += 1;
    return ide;
  }

  /**
   * Initializes a new singleton instance of the `IDE` class with the provided options.
   * Throws an error if an instance already exists.
   *
   * @param initialOptions - Optional configuration options for initializing the IDE instance.
   * @returns The attached `IDE` instance.
   * @throws {Error} If an IDE instance already exists.
   */
  public static initializeInstance(initialOptions: InitialOptions = {}): IDE {
    if (this.getInstanceIfExists()) {
      throw new Error("IDE instance already exists");
    }
    IDE.instance = new IDE(initialOptions);
    return IDE.attach();
  }

  public static getInstanceIfExists(): IDE | null {
    const ide = IDE.instance;
    if (ide && ide.attachSemaphore > 0 && ide.disposed === false) {
      return ide;
    }
    return null;
  }
}
