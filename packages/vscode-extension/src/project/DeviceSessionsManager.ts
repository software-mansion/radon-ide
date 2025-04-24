import { isEqual } from "lodash";
import { Disposable, window } from "vscode";
import { BuildError } from "../builders/BuildManager";
import { DeviceInfo } from "../common/DeviceManager";
import { ProjectState, StartupMessage } from "../common/Project";
import { DeviceAlreadyUsedError, DeviceManager } from "../devices/DeviceManager";
import { Logger } from "../Logger";
import { extensionContext } from "../utilities/extensionContext";
import { ApplicationContext } from "./ApplicationContext";
import { DeviceBootError, DeviceSession } from "./deviceSession";
import { AndroidEmulatorDevice } from "../devices/AndroidEmulatorDevice";
import { IosSimulatorDevice } from "../devices/IosSimulatorDevice";
import { CancelError } from "../builders/cancelToken";
import {
  DeviceSessionsManagerInterface,
  DeviceSessionsManagerDelegate,
  ReloadAction,
  SelectDeviceOptions,
} from "../common/DeviceSessionsManager";
import { disposeAll } from "../utilities/disposables";
import { activate } from "../extension";

const LAST_SELECTED_DEVICE_KEY = "last_selected_device";

export class DeviceSessionsManager implements DeviceSessionsManagerInterface, Disposable {
  // selected device id
  private selectedDevice: string | undefined;
  private deviceSessions: Map<string, DeviceSession> = new Map();

  public get selectedDeviceSession() {
    if (!this.selectedDevice) {
      return undefined;
    }
    return this.deviceSessions.get(this.selectedDevice);
  }

  constructor(
    private readonly applicationContext: ApplicationContext,
    private readonly deviceManager: DeviceManager,
    private readonly deviceSessionManagerDelegate: DeviceSessionsManagerDelegate,
    private readonly updateProjectState: (newState: Partial<ProjectState>) => void
  ) {
    this.trySelectingDevice();
    this.deviceManager.addListener("deviceRemoved", this.removeDeviceListener);
  }

  private async trySelectingActiveDeviceSession(id: string, killPreviousDeviceSession?: boolean) {
    if (!this.deviceSessions.has(id)) {
      return false;
    }
    if (this.selectedDevice) {
      if (killPreviousDeviceSession) {
        this.killAndRemoveDevice(this.selectedDevice);
      } else {
        await this.selectedDeviceSession?.deactivate();
      }
    }
    this.selectedDevice = id;
    this.selectedDeviceSession?.activate();
    return true;
  }

  public async reload(type: ReloadAction) {
    this.deviceSessionManagerDelegate.onReloadRequested(type);

    const deviceSession = this.selectedDeviceSession;
    if (!deviceSession) {
      window.showErrorMessage("Failed to reload, no active device found.", "Dismiss");
      return false;
    }
    try {
      const success = await deviceSession.perform(type);
      if (success) {
        this.updateProjectState({ status: "running" });
        return true;
      } else if (!success) {
        window.showErrorMessage("Failed to reload, you may try another reload option.", "Dismiss");
      }
    } catch (e) {
      if (e instanceof CancelError) {
        return false;
      }
      Logger.error("Failed to reload device", e);
      throw e;
    }
    return false;
  }

  public async stopDevice(deviceId: string) {
    if (deviceId === this.selectedDevice) {
      window.showWarningMessage(
        "You cannot stop the selected device. Please select another device first.",
        "Dismiss"
      );
      return false;
    }
    const deviceSession = this.deviceSessions.get(deviceId);
    if (!deviceSession) {
      Logger.warn("Failed to stop device, device wasn't running.", "Dismiss");
      return true;
    }
    await this.killAndRemoveDevice(deviceId);
    return true;
  }

  public async selectDevice(deviceInfo: DeviceInfo, selectDeviceOptions?: SelectDeviceOptions) {
    const killPreviousDeviceSession = !selectDeviceOptions?.preservePreviousDevice;
    const { id: newDeviceId } = deviceInfo;

    const selectedActiveSession = await this.trySelectingActiveDeviceSession(
      newDeviceId,
      killPreviousDeviceSession
    );

    if (selectedActiveSession) {
      this.deviceSessionManagerDelegate.onDeviceSelected(
        deviceInfo,
        this.selectedDeviceSession?.previewURL
      );
      return true;
    }

    const device = await this.selectDeviceOnly(deviceInfo);
    if (!device) {
      return false;
    }
    Logger.debug("Selected device is ready");

    if (this.selectedDevice) {
      if (killPreviousDeviceSession) {
        await this.killAndRemoveDevice(this.selectedDevice);
      } else {
        await this.selectedDeviceSession?.deactivate();
      }
    }

    this.updateProjectState({
      selectedDevice: deviceInfo,
      initialized: true,
      status: "starting",
      startupMessage: StartupMessage.InitializingDevice,
      previewURL: undefined,
    });

    let newDeviceSession;
    try {
      newDeviceSession = new DeviceSession(
        this.applicationContext.appRootFolder,
        device,
        this.applicationContext.dependencyManager,
        this.applicationContext.buildCache,
        this.deviceSessionManagerDelegate,
        this.deviceSessionManagerDelegate,
        this.deviceSessionManagerDelegate,
        this.deviceSessionManagerDelegate
      );
      this.deviceSessions.set(newDeviceId, newDeviceSession);
      this.selectedDevice = newDeviceId;

      const previewURL = await newDeviceSession.start({
        resetMetroCache: false,
        cleanBuild: false,
        previewReadyCallback: (url) => {
          this.updateProjectState({ previewURL: url });
        },
      });
      this.updateProjectState({
        previewURL,
        status: "running",
      });
    } catch (e) {
      Logger.error("Couldn't start device session", e instanceof Error ? e.message : e);

      const isSelected = this.selectedDevice === deviceInfo.id;
      const isNewSession = this.selectedDeviceSession === newDeviceSession;
      if (isSelected && isNewSession) {
        if (e instanceof CancelError) {
          Logger.debug("[SelectDevice] Device selection was canceled", e);
        } else if (e instanceof DeviceBootError) {
          this.updateProjectState({ status: "bootError" });
        } else if (e instanceof BuildError) {
          this.updateProjectState({
            status: "buildError",
            buildError: {
              message: e.message,
              buildType: e.buildType,
              platform: deviceInfo.platform,
            },
          });
        } else {
          this.updateProjectState({
            status: "buildError",
            buildError: {
              message: (e as Error).message,
              buildType: null,
              platform: deviceInfo.platform,
            },
          });
        }
      }
    }
    this.deviceSessionManagerDelegate.onDeviceSelected(deviceInfo);
    return true;
  }

  /**
   * This method tries to select any running device, if there isn't any
   * it tries to select the last selected device from devices list.
   * If the device list is empty, we wait until we can select a device.
   */
  private async trySelectingDevice() {
    const anyActiveDeviceSessionId = this.deviceSessions.keys().next().value;

    if (anyActiveDeviceSessionId) {
      const selectedActiveSession = await this.trySelectingActiveDeviceSession(
        anyActiveDeviceSessionId,
        true
      );
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
        // if we found a device on the devices list, we try to select it
        const isDeviceSelected = await this.selectDevice(device);
        if (isDeviceSelected) {
          return true;
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
        if (this.selectedDevice) {
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

  // used in callbacks, needs to be an arrow function
  private removeDeviceListener = async (device: DeviceInfo) => {
    if (this.selectedDevice === device.id) {
      this.updateProjectState({ status: "starting" });
      await this.killAndRemoveDevice(device.id);
      await this.trySelectingDevice();
    }
  };

  private async killAndRemoveDevice(deviceId: string) {
    const deviceSession = this.deviceSessions.get(deviceId);
    await deviceSession?.dispose();
    this.deviceSessions.delete(deviceId);
  }

  private async selectDeviceOnly(deviceInfo: DeviceInfo) {
    if (!deviceInfo.available) {
      window.showErrorMessage(
        "Selected device is not available. Perhaps the system image it uses is not installed. Please select another device.",
        "Dismiss"
      );
      return undefined;
    }
    let device: IosSimulatorDevice | AndroidEmulatorDevice | undefined;
    try {
      device = await this.deviceManager.acquireDevice(deviceInfo);
    } catch (e) {
      if (e instanceof DeviceAlreadyUsedError) {
        window.showErrorMessage(
          "This device is already used by other instance of Radon IDE.\nPlease select another device",
          "Dismiss"
        );
      } else {
        Logger.error(`Couldn't acquire the device ${deviceInfo.platform} – ${deviceInfo.id}`, e);
      }
    }

    if (device) {
      Logger.debug("Device selected", deviceInfo.displayName);
      extensionContext.workspaceState.update(LAST_SELECTED_DEVICE_KEY, deviceInfo.id);
      return device;
    }
    return undefined;
  }

  dispose() {
    disposeAll(this.deviceSessions.values().toArray());
    this.deviceManager.removeListener("deviceRemoved", this.removeDeviceListener);
  }
}
