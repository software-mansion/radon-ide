import { Disposable, window } from "vscode";
import { DeviceInfo, DevicePlatform } from "../common/DeviceManager";
import { DeviceAlreadyUsedError, DeviceManager } from "../devices/DeviceManager";
import { Logger } from "../Logger";
import { extensionContext } from "../utilities/extensionContext";
import { ApplicationContext } from "./ApplicationContext";
import { DeviceSession } from "./deviceSession";
import { AndroidEmulatorDevice } from "../devices/AndroidEmulatorDevice";
import { IosSimulatorDevice } from "../devices/IosSimulatorDevice";
import {
  DeviceSessionsManagerInterface,
  DeviceSessionsManagerDelegate,
  ReloadAction,
  SelectDeviceOptions,
} from "../common/DeviceSessionsManager";
import { disposeAll } from "../utilities/disposables";
import { DEVICE_SESSION_INITIAL_STATE } from "../common/Project";

const LAST_SELECTED_DEVICE_KEY = "last_selected_device";

export class DeviceSessionsManager implements Disposable, DeviceSessionsManagerInterface {
  private deviceSessions: Map<string, DeviceSession> = new Map();
  private activeSession: DeviceSession | undefined;
  private findingDevice: boolean = false;

  public get selectedDeviceSession() {
    return this.activeSession;
  }

  constructor(
    private readonly applicationContext: ApplicationContext,
    private readonly deviceManager: DeviceManager,
    private readonly deviceSessionManagerDelegate: DeviceSessionsManagerDelegate
  ) {
    this.findInitialDeviceAndStartSession();
    this.deviceManager.addListener("deviceRemoved", this.removeDeviceListener);
    this.deviceManager.addListener("devicesChanged", this.devicesChangedListener);
  }

  public async reloadCurrentSession(type: ReloadAction) {
    const deviceSession = this.selectedDeviceSession;
    if (!deviceSession) {
      window.showErrorMessage("Failed to reload, no active device found.", "Dismiss");
      return false;
    }
    return await deviceSession.performReloadAction(type);
  }

  private async terminatePreviousSessions() {
    const previousSessionEntries = Array.from(this.deviceSessions.entries()).filter(
      ([_deviceId, session]) => this.selectedDeviceSession !== session
    );
    return Promise.all(
      previousSessionEntries.map(([deviceId, _session]) => this.terminateSession(deviceId))
    );
  }

  public async startOrActivateSessionForDevice(
    deviceInfo: DeviceInfo,
    selectDeviceOptions?: SelectDeviceOptions
  ) {
    const killPreviousDeviceSession = !selectDeviceOptions?.preservePreviousDevice;

    // if there's an existing session for the device, we use it instead of starting a new one
    const existingDeviceSession = this.deviceSessions.get(deviceInfo.id);
    if (existingDeviceSession) {
      this.updateSelectedSession(existingDeviceSession);
      if (killPreviousDeviceSession) {
        await this.terminatePreviousSessions();
      }
      return;
    }

    // otherwise, we need to acquire the device and start a new session
    const device = await this.acquireDeviceByDeviceInfo(deviceInfo);
    if (!device) {
      return;
    }
    Logger.debug("Selected device is ready");

    const newDeviceSession = new DeviceSession(this.applicationContext, device, {
      onStateChange: (state) => {
        if (this.activeSession === newDeviceSession) {
          this.deviceSessionManagerDelegate.onActiveSessionStateChanged(state);
        }
      },
      ensureDependenciesAndNodeVersion:
        this.deviceSessionManagerDelegate.ensureDependenciesAndNodeVersion,
    });

    this.deviceSessions.set(deviceInfo.id, newDeviceSession);
    this.updateSelectedSession(newDeviceSession);

    if (killPreviousDeviceSession) {
      await this.terminatePreviousSessions();
    }

    try {
      await newDeviceSession.start();
    } catch (e) {
      Logger.error("Couldn't start device session", e instanceof Error ? e.message : e);
    }
  }

  private findInitialDeviceAndStartSession = async () => {
    try {
      this.findingDevice = true;

      const devices = await this.deviceManager.listAllDevices();

      // we try to pick the last selected device that we saved in the persistent state, otherwise
      // we take the first iOS device from the list, or any first device if there's no iOS device
      const lastDeviceId = extensionContext.workspaceState.get<string | undefined>(
        LAST_SELECTED_DEVICE_KEY
      );
      const defaultDevice =
        devices.find((device) => device.platform === DevicePlatform.IOS) ?? devices.at(0);
      const initialDevice = devices.find((device) => device.id === lastDeviceId) ?? defaultDevice;

      if (initialDevice) {
        // if we found a device on the devices list, we try to select it
        await this.startOrActivateSessionForDevice(initialDevice);
      }
    } finally {
      this.findingDevice = false;
    }
  };

  // used in callbacks, needs to be an arrow function
  private removeDeviceListener = async (device: DeviceInfo) => {
    // if the deleted device was running an active session, we need to terminate that session
    await this.terminateSession(device.id);
    // if the deleted device was the selected one, we try to select a new device
    this.findInitialDeviceAndStartSession();
  };

  private devicesChangedListener = async () => {
    // this method is triggered when new devices are added, we don't want to
    // run the device selection process, if an existing session is already running
    // or if we're already in the process of finding a device (either because of a
    // previous event or becuase we only just booted up the manager).
    if (this.selectedDeviceSession && !this.findingDevice) {
      return;
    }
    this.findInitialDeviceAndStartSession();
  };

  private updateSelectedSession(session: DeviceSession | undefined) {
    const previousSession = this.activeSession;
    this.activeSession = session;
    if (previousSession !== session) {
      previousSession?.deactivate();
      session?.activate();
      this.deviceSessionManagerDelegate.onActiveSessionStateChanged(
        session?.getState() ?? DEVICE_SESSION_INITIAL_STATE
      );
    }
  }

  private async terminateSession(deviceId: string) {
    const session = this.deviceSessions.get(deviceId);
    if (session) {
      this.deviceSessions.delete(deviceId);
      if (session === this.activeSession) {
        this.updateSelectedSession(undefined);
      }
      await session.dispose();
    }
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
    this.deviceManager.removeListener("devicesChanged", this.devicesChangedListener);
  }
}
