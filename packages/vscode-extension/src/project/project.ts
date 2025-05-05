import { EventEmitter } from "stream";
import os from "os";
import {
  Disposable,
  commands,
  workspace,
  window,
  ConfigurationChangeEvent,
} from "vscode";
import _ from "lodash";
import {
  ProjectEventListener,
  ProjectEventMap,
  ProjectInterface,
  ProjectState,
  ZoomLevelType,
} from "../common/Project";
import { Logger } from "../Logger";
import { DeviceManager } from "../devices/DeviceManager";
import { extensionContext } from "../utilities/extensionContext";
import {
  activateDevice,
  watchLicenseTokenChange,
  getLicenseToken,
  refreshTokenPeriodically,
} from "../utilities/license";
import { getTelemetryReporter } from "../utilities/telemetry";
import { UtilsInterface } from "../common/utils";
import { ApplicationContext } from "./ApplicationContext";
import { disposeAll } from "../utilities/disposables";
import { findAndSetupNewAppRootFolder } from "../utilities/findAndSetupNewAppRootFolder";
import { getLaunchConfiguration } from "../utilities/launchConfiguration";
import { DeviceSessionsManager } from "./DeviceSessionsManager";
import { DeviceSessionsManagerDelegate } from "../common/DeviceSessionsManager";

const PREVIEW_ZOOM_KEY = "preview_zoom";
const DEEP_LINKS_HISTORY_KEY = "deep_links_history";

const DEEP_LINKS_HISTORY_LIMIT = 50;

export class Project implements Disposable, ProjectInterface, DeviceSessionsManagerDelegate {
  private applicationContext: ApplicationContext;
  private eventEmitter = new EventEmitter();

  public deviceSessionsManager: DeviceSessionsManager;

  private projectState: ProjectState = {
    previewZoom: extensionContext.workspaceState.get(PREVIEW_ZOOM_KEY),
    selectedDevice: undefined,
  };

  private disposables: Disposable[] = [];

  constructor(
    private readonly deviceManager: DeviceManager,
    private readonly utils: UtilsInterface
  ) {
    const appRoot = findAndSetupNewAppRootFolder();
    this.applicationContext = new ApplicationContext(appRoot);
    this.deviceSessionsManager = new DeviceSessionsManager(
      this.applicationContext,
      this.deviceManager,
      this.utils,
      this
    );

    this.disposables.push(refreshTokenPeriodically());
    this.disposables.push(
      watchLicenseTokenChange(async () => {
        const hasActiveLicense = await this.hasActiveLicense();
        this.eventEmitter.emit("licenseActivationChanged", hasActiveLicense);
      })
    );

    this.disposables.push(
      workspace.onDidChangeConfiguration((event: ConfigurationChangeEvent) => {
        if (event.affectsConfiguration("launch")) {
          const config = getLaunchConfiguration();
          const oldAppRoot = this.appRootFolder;
          if (config.appRoot === oldAppRoot) {
            return;
          }
          this.setupAppRoot();

          if (this.appRootFolder === undefined) {
            window.showErrorMessage(
              "Unable to find the new app root, after a change in launch configuration. Radon IDE might not work properly.",
              "Dismiss"
            );
            return;
          }
        }
      })
    );
  }

  // Frytki
  // onDeviceStateChanged(newState: DeviceState): Promise<void> {
  //   throw new Error("Method not implemented.");
  // }

  get appRootFolder() {
    return this.applicationContext.appRootFolder;
  }

  get dependencyManager() {
    return this.applicationContext.dependencyManager;
  }

  get launchConfig() {
    return this.applicationContext.launchConfig;
  }

  get buildCache() {
    return this.applicationContext.buildCache;
  }

  private setupAppRoot() {
    const newAppRoot = findAndSetupNewAppRootFolder();

    const oldApplicationContext = this.applicationContext;
    this.applicationContext = new ApplicationContext(newAppRoot);
    oldApplicationContext.dispose();

    const oldDeviceSessionsManager = this.deviceSessionsManager;
    this.deviceSessionsManager = new DeviceSessionsManager(
      this.applicationContext,
      this.deviceManager,
      this.utils,
      this
    );
    oldDeviceSessionsManager.dispose();
  }

  //#endregion

  // async onBundlingError(
  //   message: string,
  //   source: DebugSource,
  //   _errorModulePath: string
  // ): Promise<void> {
  //   await this.deviceSession?.appendDebugConsoleEntry(message, "error", source);

  //   if (this.projectState.status === "starting") {
  //     focusSource(source);
  //   }

  //   Logger.error("[Bundling Error]", message);

  //   this.updateProjectState({ status: "bundlingError" });
  // }

  // onBundleProgress = throttle((stageProgress: number) => {
  //   this.reportStageProgress(stageProgress, StartupMessage.WaitingForAppToLoad);
  // }, 100);

  async getProjectState(): Promise<ProjectState> {
    return this.projectState;
  }

  async addListener<K extends keyof ProjectEventMap>(
    eventType: K,
    listener: ProjectEventListener<ProjectEventMap[K]>
  ) {
    this.eventEmitter.addListener(eventType, listener);
  }
  async removeListener<K extends keyof ProjectEventMap>(
    eventType: K,
    listener: ProjectEventListener<ProjectEventMap[K]>
  ) {
    this.eventEmitter.removeListener(eventType, listener);
  }

  public dispose() {
    this.deviceSession?.dispose();
    this.applicationContext.dispose();
    disposeAll(this.disposables);
  }

  public async focusExtensionLogsOutput() {
    Logger.openOutputPanel();
  }

  public async focusDebugConsole() {
    commands.executeCommand("workbench.panel.repl.view.focus");
  }

  public async activateLicense(activationKey: string) {
    const computerName = os.hostname();
    const activated = await activateDevice(activationKey, computerName);
    return activated;
  }

  public async hasActiveLicense() {
    return !!(await getLicenseToken());
  }


  // Frytki z ketchup  call it through device manager instead of project
  // public async renameDevice(deviceInfo: DeviceInfo, newDisplayName: string) {
  //   await this.deviceManager.renameDevice(deviceInfo, newDisplayName);
  //   deviceInfo.displayName = newDisplayName;
  //   if (this.projectState.selectedDevice?.id === deviceInfo.id) {
  //     this.updateProjectState({ selectedDevice: deviceInfo });
  //   }
  // }

  public async runCommand(command: string): Promise<void> {
    await commands.executeCommand(command);
  }

  private updateProjectState(newState: Partial<ProjectState>) {
    // NOTE: this is unsafe, but I'm not sure there's a way to enforce the type of `newState` correctly
    const mergedState: any = { ...this.projectState, ...newState };
    // stageProgress is tied to a startup stage, so when there is a change of status or startupMessage,
    // we always want to reset the progress.
    if (
      newState.status !== undefined ||
      ("startupMessage" in newState && newState.startupMessage !== undefined)
    ) {
      delete mergedState.stageProgress;
    }
    this.projectState = mergedState;
    this.eventEmitter.emit("projectStateChanged", this.projectState);
  }

  public async updatePreviewZoomLevel(zoom: ZoomLevelType): Promise<void> {
    this.updateProjectState({ previewZoom: zoom });
    extensionContext.workspaceState.update(PREVIEW_ZOOM_KEY, zoom);
  }

  async getDeepLinksHistory() {
    return extensionContext.workspaceState.get<string[] | undefined>(DEEP_LINKS_HISTORY_KEY) ?? [];
  }

  async onOpenDeepLink(link: string) {
    const history = await this.getDeepLinksHistory();
    if (history.length === 0 || link !== history[0]) {
      extensionContext.workspaceState.update(
        DEEP_LINKS_HISTORY_KEY,
        [link, ...history.filter((s) => s !== link)].slice(0, DEEP_LINKS_HISTORY_LIMIT)
      );
    }
  }

  public async ensureDependenciesAndNodeVersion() {
    if (this.dependencyManager === undefined) {
      Logger.error(
        "[PROJECT] Dependency manager not initialized. this code should be unreachable."
      );
      throw new Error("[PROJECT] Dependency manager not initialized");
    }

    const installed = await this.dependencyManager.checkNodeModulesInstallationStatus();

    if (!installed) {
      Logger.info("Installing node modules");
      await this.dependencyManager.installNodeModules();
      Logger.debug("Installing node modules succeeded");
    } else {
      Logger.debug("Node modules already installed - skipping");
    }

    const supportedNodeInstalled =
      await this.dependencyManager.checkSupportedNodeVersionInstalled();
    if (!supportedNodeInstalled) {
      throw new Error(
        "Node.js was not found, or the version in the PATH does not satisfy minimum version requirements."
      );
    }
  }
}
