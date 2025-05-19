import { EventEmitter } from "stream";
import { Disposable, workspace, window, ConfigurationChangeEvent } from "vscode";
import os from "os";
import _, { isEqual } from "lodash";
import {
  ProjectEventListener,
  ProjectEventMap,
  ProjectInterface,
  ProjectState,
  SelectDeviceOptions,
  ZoomLevelType,
} from "../common/Project";
import { Logger } from "../Logger";
import { DeviceManager } from "../devices/DeviceManager";
import { extensionContext } from "../utilities/extensionContext";
import {
  watchLicenseTokenChange,
  refreshTokenPeriodically,
  activateDevice,
  getLicenseToken,
} from "../utilities/license";
import { UtilsInterface } from "../common/utils";
import { ApplicationContext } from "./ApplicationContext";
import { disposeAll } from "../utilities/disposables";
import { findAndSetupNewAppRootFolder } from "../utilities/findAndSetupNewAppRootFolder";
import { getLaunchConfiguration } from "../utilities/launchConfiguration";
import { DeviceSessionsManager } from "./DeviceSessionsManager";
import { DeviceSessionsManagerDelegate } from "../common/DeviceSessionsManager";
import { DeviceId, DeviceInfo } from "../common/DeviceManager";

const PREVIEW_ZOOM_KEY = "preview_zoom";
const DEEP_LINKS_HISTORY_KEY = "deep_links_history";
const LAST_SELECTED_DEVICE_KEY = "last_selected_device";

const DEEP_LINKS_HISTORY_LIMIT = 50;

export class Project implements Disposable, ProjectInterface, DeviceSessionsManagerDelegate {
  private applicationContext: ApplicationContext;
  private eventEmitter = new EventEmitter();

  public deviceSessionsManager: DeviceSessionsManager;

  public projectState: ProjectState = {
    previewZoom: extensionContext.workspaceState.get(PREVIEW_ZOOM_KEY),
    selectedDevice: undefined,
    initialized: false,
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

    this.deviceManager.addListener("deviceRemoved", this.removeDeviceListener);

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
    this.trySelectingDevice();
  }

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

  // used in callbacks, needs to be an arrow function
  private removeDeviceListener = async (device: DeviceInfo) => {
    await this.deviceSessionsManager.stopDevice(device.id);
    if (this.projectState.selectedDevice === device.id) {
      await this.trySelectingDevice();
    }
  };

  /**
   * This method tries to select any running device, if there isn't any
   * it tries to select the last selected device from devices list.
   * If the device list is empty, we wait until we can select a device.
   */
  private async trySelectingDevice() {
    const runningDeviceSessions = await this.deviceSessionsManager.listRunningDevices();

    if (runningDeviceSessions.length > 0) {
      const selectedActiveSession = await this.selectDevice(runningDeviceSessions[0]);

      if (selectedActiveSession) {
        return true;
      }
    }

    const selectInitialDevice = async (devices: DeviceInfo[]) => {
      // we try to pick the last selected device that we saved in the persistent state, otherwise
      // we take the first device from the list
      const lastDeviceId = extensionContext.workspaceState.get<string | undefined>(
        LAST_SELECTED_DEVICE_KEY
      );
      const device = devices.find(({ id }) => id === lastDeviceId) ?? devices.at(0);

      if (device) {
        const initialized = await this.deviceSessionsManager.initializeDevice(device);

        if (initialized) {
          this.updateProjectState({ initialized: true });
          const isDeviceSelected = await this.selectDevice(device.id);
          if (isDeviceSelected) {
            return true;
          }
        }
      }

      // if device selection wasn't successful we will retry it later on when devicesChange
      // event is emitted (i.e. when user create a new device). We also make sure that the
      // device selection is cleared in the project state:
      this.updateProjectState({
        selectedDevice: undefined,
        initialized: true, // when no device can be selected, we consider the project initialized
      });
      // when we reach this place, it means there's no device that we can select, we
      // wait for the new device to be added to the list:
      const listener = async (newDevices: DeviceInfo[]) => {
        this.deviceManager.removeListener("devicesChanged", listener);
        if (this.projectState.selectedDevice) {
          // device was selected in the meantime, we don't need to do anything
          return;
        } else if (isEqual(newDevices, devices)) {
          // list is the same, we register listener to wait for the next change
          this.deviceManager.addListener("devicesChanged", listener);
        } else {
          selectInitialDevice(newDevices);
        }
      };

      // we trigger initial listener call with the most up to date list of devices
      listener(await this.deviceManager.listAllDevices());

      return false;
    };

    const devices = await this.deviceManager.listAllDevices();
    await selectInitialDevice(devices);
  }

  // #region Project State
  async getProjectState(): Promise<ProjectState> {
    return this.projectState;
  }

  private updateProjectState(newState: Partial<ProjectState>) {
    // NOTE: this is unsafe, but I'm not sure there's a way to enforce the type of `newState` correctly
    const mergedState: any = { ...this.projectState, ...newState };

    this.projectState = mergedState;
    this.eventEmitter.emit("projectStateChanged", this.projectState);
  }

  public async updatePreviewZoomLevel(zoom: ZoomLevelType): Promise<void> {
    this.updateProjectState({ previewZoom: zoom });
    extensionContext.workspaceState.update(PREVIEW_ZOOM_KEY, zoom);
  }

  public async selectDevice(deviceId: DeviceId, selectDeviceOptions?: SelectDeviceOptions) {
    if (!(await this.deviceSessionsManager.listRunningDevices()).includes(deviceId)) {
      Logger.error("[DeviceSessionManager] Device was not started yet.");
      return false;
    }

    const previousDevice = this.projectState.selectedDevice;

    if (previousDevice) {
      const killPreviousDeviceSession = !selectDeviceOptions?.preservePreviousDevice;

      await this.deviceSessionsManager.deactivateDevice(previousDevice);
      if (killPreviousDeviceSession) {
        await this.deviceSessionsManager.stopDevice(previousDevice);
      }
    }
    this.updateProjectState({ selectedDevice: deviceId });
    await this.deviceSessionsManager.activateDevice(deviceId);
    extensionContext.workspaceState.update(LAST_SELECTED_DEVICE_KEY, deviceId);
    return true;
  }

  // #endregion

  // #region deep links

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

  // #endregion

  // #region license management

  public async activateLicense(activationKey: string) {
    const computerName = os.hostname();
    const activated = await activateDevice(activationKey, computerName);
    return activated;
  }

  public async hasActiveLicense() {
    return !!(await getLicenseToken());
  }

  // #region dependencies checks

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

  // #endregion

  // #region eventEmitter implementation

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

  // #endregion

  // #region disposable implementation

  public dispose() {
    this.applicationContext.dispose();
    this.deviceSessionsManager.dispose();
    this.deviceManager.removeListener("deviceRemoved", this.removeDeviceListener);
    disposeAll(this.disposables);
  }

  // #endregion
}
