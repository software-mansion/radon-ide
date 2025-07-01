import { Disposable, window } from "vscode";
import _ from "lodash";
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
  LAST_SELECTED_DEVICE_KEY,
  ReloadAction,
  SelectDeviceOptions,
} from "../common/DeviceSessionsManager";
import { disposeAll } from "../utilities/disposables";
import { DeviceId, DeviceSessionsManagerState } from "../common/Project";

const SWITCH_DEVICE_THROTTLE_MS = 300;

export type DeviceSessionsManagerDelegate = {
  onDeviceSessionsManagerStateChange(state: DeviceSessionsManagerState): void;
};

const MAX_ALLOWED_IOS_DEVICES = 3;
const MAX_ALLOWED_ANDROID_DEVICES = 1;

export class DeviceSessionsManager implements Disposable, DeviceSessionsManagerInterface {
  private deviceSessions: Map<DeviceId, DeviceSession> = new Map();
  private activeSessionId: DeviceId | undefined;
  private findingDevice: boolean = false;
  private previousDevices: DeviceInfo[] = [];

  constructor(
    private readonly applicationContext: ApplicationContext,
    private readonly deviceManager: DeviceManager,
    private readonly deviceSessionManagerDelegate: DeviceSessionsManagerDelegate
  ) {
    this.deviceManager.addListener("deviceRemoved", this.removeDeviceListener);
    this.deviceManager.addListener("devicesChanged", this.devicesChangedListener);
  }

  public get selectedDeviceSession(): DeviceSession | undefined {
    return this.activeSessionId ? this.deviceSessions.get(this.activeSessionId) : undefined;
  }

  public async terminateSession(deviceId: string) {
    const session = this.deviceSessions.get(deviceId);
    if (session) {
      if (session === this.selectedDeviceSession) {
        this.updateSelectedSession(undefined);
      }
      this.deviceSessions.delete(deviceId);
      this.deviceSessionManagerDelegate.onDeviceSessionsManagerStateChange(this.state);
      await session.dispose();
    }
  }

  private get state(): DeviceSessionsManagerState {
    return {
      selectedSessionId: this.activeSessionId ?? null,
      deviceSessions: Object.fromEntries(
        this.deviceSessions.entries().map(([k, v]) => [k, v.getState()])
      ),
    };
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
      ([deviceId, _session]) => deviceId !== this.activeSessionId
    );
    return Promise.all(
      previousSessionEntries.map(([deviceId, _session]) => this.terminateSession(deviceId))
    );
  }

  public async startOrActivateSessionForDevice(
    deviceInfo: DeviceInfo,
    selectDeviceOptions?: SelectDeviceOptions
  ) {
    const stopPreviousDevices = selectDeviceOptions?.stopPreviousDevices;

    // if there's an existing session for the device, we use it instead of starting a new one
    const existingDeviceSession = this.deviceSessions.get(deviceInfo.id);
    if (existingDeviceSession) {
      this.updateSelectedSession(existingDeviceSession);
      if (stopPreviousDevices) {
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
        if (!this.deviceSessions.has(state.deviceInfo.id)) {
          // NOTE: the device is being removed, we shouldn't report state updates
          return;
        }
        this.deviceSessionManagerDelegate.onDeviceSessionsManagerStateChange(this.state);
      },
    });

    this.deviceSessionManagerDelegate.onDeviceSessionsManagerStateChange(this.state);
    this.deviceSessions.set(deviceInfo.id, newDeviceSession);
    this.maybeWarnAboutRunningDevices();
    this.updateSelectedSession(newDeviceSession);

    if (stopPreviousDevices) {
      await this.terminatePreviousSessions();
    }

    try {
      await newDeviceSession.start();
    } catch (e) {
      Logger.error("Couldn't start device session", e instanceof Error ? e.message : e);
    }
  }

  private maybeWarnAboutRunningDevices() {
    const shouldWarn = extensionContext.globalState.get<boolean>("warnAboutMultipleDevices", true);
    if (!shouldWarn) {
      return;
    }

    const [iosDevices, androidDevices] = _.partition(
      this.deviceSessions.values().toArray(),
      (session) => session.getState().deviceInfo.platform === DevicePlatform.IOS
    );

    if (
      iosDevices.length > MAX_ALLOWED_IOS_DEVICES ||
      androidDevices.length > MAX_ALLOWED_ANDROID_DEVICES
    ) {
      window
        .showWarningMessage(
          "You have multiple devices running. This may cause performance issues. " +
            "Consider stopping some of them.",
          "Don't show this again",
          "Dismiss"
        )
        .then((selection) => {
          if (selection === "Don't show this again") {
            extensionContext.globalState.update("warnAboutMultipleDevices", false);
          }
        });
    }
  }

  // used in callbacks, needs to be an arrow function
  private removeDeviceListener = async (device: DeviceInfo) => {
    // if the deleted device was running an active session, we need to terminate that session
    await this.terminateSession(device.id);
  };

  private devicesChangedListener = async (devices: DeviceInfo[]) => {
    const previousDevices = this.previousDevices;
    this.previousDevices = devices;
    // if this event is triggered due to the first device being created, we want to select it immediately.
    if (previousDevices.length === 0 && devices.length > 0) {
      const firstDevice = devices[0];
      this.startOrActivateSessionForDevice(firstDevice);
    }
  };

  private async updateSelectedSession(session: DeviceSession | undefined) {
    const previousSession = this.selectedDeviceSession;
    this.activeSessionId = session?.getState().deviceInfo.id;
    if (previousSession === session) {
      return;
    }
    if (session === undefined) {
      this.deviceSessionManagerDelegate.onDeviceSessionsManagerStateChange(this.state);
      return;
    }
    await previousSession?.deactivate();
    await session.activate();
    extensionContext.workspaceState.update(LAST_SELECTED_DEVICE_KEY, this.activeSessionId);
    this.deviceSessionManagerDelegate.onDeviceSessionsManagerStateChange(this.state);
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
      return device;
    }
    return undefined;
  }

  public selectNextNthRunningSession = _.throttle((offset: number) => {
    const runningSessions = this.deviceSessions.keys().toArray();
    const currentSessionIndex =
      this.activeSessionId !== undefined ? runningSessions.indexOf(this.activeSessionId) : -offset;
    const nextSessionIndex =
      (currentSessionIndex + offset + runningSessions.length) % runningSessions.length;
    this.updateSelectedSession(this.deviceSessions.get(runningSessions[nextSessionIndex]));
  }, SWITCH_DEVICE_THROTTLE_MS);

  dispose() {
    disposeAll(this.deviceSessions.values().toArray());
    this.deviceManager.removeListener("deviceRemoved", this.removeDeviceListener);
    this.deviceManager.removeListener("devicesChanged", this.devicesChangedListener);
  }
}
