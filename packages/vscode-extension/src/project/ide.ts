import { Disposable, ExtensionContext } from "vscode";
import { Project } from "./project";
import { DeviceManager } from "../devices/DeviceManager";
import { DependencyManager } from "../dependency/DependencyManager";
import { WorkspaceConfigController } from "../panels/WorkspaceConfigController";
import { LaunchConfigController } from "../panels/LaunchConfigController";
import { Utils } from "../utilities/utils";

export class IDE implements Disposable {
  private static instance: IDE | null = null;

  public readonly deviceManager: DeviceManager;
  public readonly dependencyManager: DependencyManager;
  public readonly project: Project;
  public readonly workspaceConfigController: WorkspaceConfigController;
  public readonly launchConfig: LaunchConfigController;
  public readonly utils: Utils;

  private disposed = false;
  private disposables: Disposable[] = [];

  constructor(context: ExtensionContext) {
    this.deviceManager = new DeviceManager();
    this.dependencyManager = new DependencyManager();
    this.project = new Project(this.deviceManager, this.dependencyManager);
    this.workspaceConfigController = new WorkspaceConfigController();
    this.launchConfig = new LaunchConfigController();
    this.utils = new Utils();

    this.disposables.push(
      this.dependencyManager,
      this.project,
      this.workspaceConfigController,
      this.launchConfig
    );
    // register disposable with context
    context.subscriptions.push(this);
  }

  dispose() {
    if (!this.disposed) {
      if (IDE.instance === this) {
        IDE.instance = null;
      }
      this.disposed = true;
      this.disposables.forEach((d) => d.dispose());
    }
  }

  public static getOrCreateInstance(context: ExtensionContext): IDE {
    if (!IDE.instance) {
      IDE.instance = new IDE(context);
    }
    return IDE.instance;
  }
}
