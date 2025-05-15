import { isEqual } from "lodash";
import { Disposable, window } from "vscode";
import { DeviceInfo, DevicePlatform } from "../common/DeviceManager";
import { DeviceAlreadyUsedError, DeviceManager } from "../devices/DeviceManager";
import { Logger } from "../Logger";
import { extensionContext } from "../utilities/extensionContext";
import { ApplicationContext } from "./ApplicationContext";
import { DeviceSession, DeviceSessionDelegate } from "./deviceSession";
import { AndroidEmulatorDevice } from "../devices/AndroidEmulatorDevice";
import { IosSimulatorDevice } from "../devices/IosSimulatorDevice";
import {
  DeviceSessionsManagerInterface,
  DeviceSessionsManagerDelegate,
  ReloadAction,
  SelectDeviceOptions,
} from "../common/DeviceSessionsManager";
import { disposeAll } from "../utilities/disposables";
import { DeviceSessionInitialState } from "../common/Project";

const LAST_SELECTED_DEVICE_KEY = "last_selected_device";

export class DeviceSessionsManager implements Disposable, DeviceSessionsManagerInterface {
  private deviceSessions: Set<DeviceSession> = new Set();
  private activeSession: DeviceSession | undefined;

  public get selectedDeviceSession() {
    return this.activeSession;
  }

  constructor(
    private readonly applicationContext: ApplicationContext,
    private readonly deviceManager: DeviceManager,
    private readonly deviceSessionManagerDelegate: DeviceSessionsManagerDelegate
  ) {
    this.findDeviceAndStartSession();
    this.deviceManager.addListener("deviceRemoved", this.removeDeviceListener);
  }

  public async reloadCurrentSession(type: ReloadAction) {
    const deviceSession = this.selectedDeviceSession;
    if (!deviceSession) {
      window.showErrorMessage("Failed to reload, no active device found.", "Dismiss");
      return false;
    }
    return await deviceSession.performReloadAction(type);
  }

  public async startOrActivateSessionForDevice(
    deviceInfo: DeviceInfo,
    selectDeviceOptions?: SelectDeviceOptions
  ) {
    const killPreviousDeviceSession = !selectDeviceOptions?.preservePreviousDevice;

    const existingSession = this.deviceSessions
      .values()
      .find((session) => session.deviceInfo.id === deviceInfo.id);
    if (existingSession) {
      this.updateSelectedSession(existingSession);
      const otherSessions = this.deviceSessions
        .values()
        .filter((session) => session !== existingSession);
      await Promise.all(otherSessions.map((session) => this.terminateSession(session)));
      return true;
    }

    const device = await this.acquireDeviceByDeviceInfo(deviceInfo);
    if (!device) {
      return false;
    }
    Logger.debug("Selected device is ready");

    const newDeviceSession = new DeviceSession(
      this.applicationContext.appRootFolder,
      deviceInfo,
      device,
      this.applicationContext.dependencyManager,
      this.applicationContext.buildCache,
      {
        onStateChange: (state) => {
          if (this.activeSession === newDeviceSession) {
            this.deviceSessionManagerDelegate.onActiveSessionStateChanged(state);
          }
        },
        ensureDependenciesAndNodeVersion: async () => {},
      }
    );

    const previousSessions = this.deviceSessions.values();
    this.deviceSessions.add(newDeviceSession);
    this.updateSelectedSession(newDeviceSession);

    if (killPreviousDeviceSession) {
      await Promise.all(previousSessions.map((session) => this.terminateSession(session)));
    }

    try {
      await newDeviceSession.start({
        resetMetroCache: false,
        cleanBuild: false,
      });
    } catch (e) {
      Logger.error("Couldn't start device session", e instanceof Error ? e.message : e);
      return false;
    }
    return true;
  }

  /**
   * This method tries to select any running device, if there isn't any
   * it tries to select the last selected device from devices list.
   * If the device list is empty, we wait until we can select a device.
   */
  private async findDeviceAndStartSession() {
    // if (this.deviceSessions.size > 0) {
    // if there is some session already running, we switch to that session

    // const selectedActiveSession = await this.trySelectingActiveDeviceSession(
    //   anyActiveDeviceSessionId,
    //   true
    // );
    // if (selectedActiveSession) {
    //   return true;
    // }
    // }

    const findAndStartInternal = async (devices: DeviceInfo[]) => {
      // we try to pick the last selected device that we saved in the persistent state, otherwise
      // we take the first device from the list
      const lastDeviceId = extensionContext.workspaceState.get<string | undefined>(
        LAST_SELECTED_DEVICE_KEY
      );
      // we select first iOS device if the user didn't use any device before
      const defaultDevice =
        devices.find((device) => device.platform === DevicePlatform.IOS) ?? devices.at(0);
      const device = devices.find((device) => device.id === lastDeviceId) ?? defaultDevice;

      if (device) {
        // if we found a device on the devices list, we try to select it
        const isDeviceSelected = await this.startOrActivateSessionForDevice(device);
        if (isDeviceSelected) {
          return true;
        }
      }

      // if device selection wasn't successful we will retry it later on when devicesChange
      // event is emitted (i.e. when user create a new device). We also make sure that the
      // device selection is cleared in the project state:
      this.updateSelectedSession(undefined);

      // when we reach this place, it means there's no device that we can select, we
      // wait for the new device to be added to the list:
      const listener = async (newDevices: DeviceInfo[]) => {
        this.deviceManager.removeListener("devicesChanged", listener);
        if (this.activeSession) {
          // device was selected in the meantime, we don't need to do anything
          return;
        } else if (isEqual(newDevices, devices)) {
          // list is the same, we register listener to wait for the next change
          this.deviceManager.addListener("devicesChanged", listener);
        } else {
          findAndStartInternal(newDevices);
        }
      };

      // we trigger initial listener call with the most up to date list of devices
      listener(await this.deviceManager.listAllDevices());

      return false;
    };

    const devices = await this.deviceManager.listAllDevices();
    await findAndStartInternal(devices);
  }

  // used in callbacks, needs to be an arrow function
  private removeDeviceListener = async (device: DeviceInfo) => {
    // if the deleted device was running an active session, we need to terminate that session
    this.deviceSessions.forEach((session) => {
      if (session.deviceInfo.id === device.id) {
        this.terminateSession(session);
      }
    });
  };

  private updateSelectedSession(session: DeviceSession | undefined) {
    const previousSession = this.activeSession;
    this.activeSession = session;
    if (previousSession !== session) {
      previousSession?.deactivate();
      session?.activate();
    }
    if (session) {
      this.deviceSessionManagerDelegate.onActiveSessionStateChanged(session.getState());
    } else {
      this.deviceSessionManagerDelegate.onActiveSessionStateChanged(DeviceSessionInitialState);
    }
  }

  private async terminateSession(session: DeviceSession) {
    this.deviceSessions.delete(session);
    if (session === this.activeSession) {
      this.updateSelectedSession(undefined);
    }
    await session.dispose();
  }

  private async acquireDeviceByDeviceInfo(deviceInfo: DeviceInfo) {
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
