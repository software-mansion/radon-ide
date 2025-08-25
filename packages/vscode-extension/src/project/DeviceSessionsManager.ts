import { Disposable, window } from "vscode";
import _ from "lodash";
import { DeviceAlreadyUsedError, DeviceManager } from "../devices/DeviceManager";
import { Logger } from "../Logger";
import { extensionContext } from "../utilities/extensionContext";
import { ApplicationContext } from "./ApplicationContext";
import { DeviceSession } from "./deviceSession";
import { AndroidEmulatorDevice } from "../devices/AndroidEmulatorDevice";
import { IosSimulatorDevice } from "../devices/IosSimulatorDevice";
import { disposeAll } from "../utilities/disposables";
import { DeviceId, DeviceSessionsManagerState } from "../common/Project";
import { Connector } from "../connect/Connector";
import { OutputChannelRegistry } from "./OutputChannelRegistry";
import { StateManager } from "./StateManager";
import {
  DeviceInfo,
  DevicePlatform,
  DeviceRotation,
  DeviceSessions,
  DevicesState,
  initialDeviceSessionStore,
  ProjectStore,
} from "../common/State";

const LAST_SELECTED_DEVICE_KEY = "last_selected_device";
const SWITCH_DEVICE_THROTTLE_MS = 300;

export type SelectDeviceOptions = {
  stopPreviousDevices?: boolean;
};

export type ReloadAction =
  | "autoReload" // automatic reload mode
  | "restartMetro"
  | "clearMetro" // clear metro cache, boot device, install app
  | "rebuild" // clean build, boot device, install app
  | "reboot" // reboots device, launch app
  | "reinstall" // force reinstall app
  | "restartProcess" // relaunch app
  | "reloadJs"; // refetch JS scripts from metro

export type DeviceSessionsManagerDelegate = {
  onInitialized(): void;
  onDeviceSessionsManagerStateChange(state: DeviceSessionsManagerState): void;
  getDeviceRotation(): DeviceRotation;
};

const MAX_ALLOWED_IOS_DEVICES = 3;
const MAX_ALLOWED_ANDROID_DEVICES = 1;

export class DeviceSessionsManager implements Disposable {
  private disposables: Disposable[] = [];
  private deviceSessions: Map<DeviceId, DeviceSession> = new Map();
  private activeSessionId: DeviceId | undefined;
  private findingDevice: boolean = false;
  private previousDevices: DeviceInfo[] = [];

  constructor(
    private readonly stateManager: StateManager<DeviceSessions>,
    // note: this manager is owned by the project
    private readonly projectStateManager: StateManager<ProjectStore>,
    private readonly applicationContext: ApplicationContext,
    private readonly deviceManager: DeviceManager,
    private readonly devicesStateManager: StateManager<DevicesState>,
    private readonly deviceSessionManagerDelegate: DeviceSessionsManagerDelegate,
    private readonly outputChannelRegistry: OutputChannelRegistry
  ) {
    this.disposables.push(
      this.devicesStateManager.onSetState((partialState) => {
        const devices = partialState.devices;
        if (devices !== undefined && devices !== null) {
          this.devicesChangedListener(devices);
        }
      })
    );

    this.disposables.push(this.stateManager);
  }

  public get selectedDeviceSession(): DeviceSession | undefined {
    return this.activeSessionId ? this.deviceSessions.get(this.activeSessionId) : undefined;
  }

  public rotateAllDevices(rotation: DeviceRotation) {
    this.deviceSessions.forEach((session) => {
      session.sendRotate(rotation);
    });
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
      return;
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

  public async terminateAllSessions() {
    const sessionEntries = Array.from(this.deviceSessions.entries());
    return Promise.all(
      sessionEntries.map(([deviceId, _session]) => this.terminateSession(deviceId))
    );
  }

  public async startOrActivateSessionForDevice(
    deviceInfo: DeviceInfo,
    selectDeviceOptions?: SelectDeviceOptions
  ) {
    Connector.getInstance().disable();
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

    if (!this.stateManager.getState()[deviceInfo.id]) {
      // we need to initialize the device session state before deriving a new state manager
      this.stateManager.setState({ [deviceInfo.id]: initialDeviceSessionStore });
    }

    const newDeviceSession = new DeviceSession(
      this.stateManager.getDerived(deviceInfo.id),
      this.applicationContext,
      device,
      this.deviceSessionManagerDelegate.getDeviceRotation(),
      {
        onStateChange: (state) => {
          if (!this.deviceSessions.has(state.deviceInfo.id)) {
            // NOTE: the device is being removed, we shouldn't report state updates
            return;
          }
          this.deviceSessionManagerDelegate.onDeviceSessionsManagerStateChange(this.state);
        },
      },
      this.outputChannelRegistry
    );

    this.deviceSessionManagerDelegate.onDeviceSessionsManagerStateChange(this.state);
    this.deviceSessions.set(deviceInfo.id, newDeviceSession);
    this.maybeWarnAboutRunningDevices();
    this.updateSelectedSession(newDeviceSession);
    this.deviceSessionManagerDelegate.onInitialized();

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

  public findInitialDeviceAndStartSession = async () => {
    if (!this.applicationContext.workspaceConfiguration.startDeviceOnLaunch) {
      this.deviceSessionManagerDelegate.onInitialized();
      return;
    }
    if (Connector.getInstance().isEnabled) {
      // when radon connect is enabled, we don't want to automatically select and start a device
      return;
    }
    if (this.findingDevice) {
      // NOTE: if we are already in the process of finding a device, we don't want to start it again
      return;
    }
    try {
      this.findingDevice = true;

      const devices = this.devicesStateManager.getState().devices;
      if (devices === null) {
        // If no devices are found, we can return early
        return;
      }
      this.previousDevices = devices;

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
      // even if no device can be selected mark project as initialized
      this.deviceSessionManagerDelegate.onInitialized();
    }
  };

  // used in callbacks, needs to be an arrow function
  private devicesChangedListener = async (devices: DeviceInfo[]) => {
    const previousDevices = this.previousDevices;
    const removedDevices = previousDevices.filter(
      (prevDevice) => !devices.some((device) => device.id === prevDevice.id)
    );

    if (removedDevices.length > 1) {
      Logger.warn(
        "Multiple devices were removed in one update, the results might be unpredictable. These devices were removed:",
        removedDevices
      );
    }

    await Promise.all(
      removedDevices.map((device) => {
        this.terminateSession(device.id);
      })
    );

    this.previousDevices = devices;
    // if this event is triggered due to the first device being created, we want to select it immediately.
    if (previousDevices.length === 0) {
      this.findInitialDeviceAndStartSession();
    }
  };

  private async updateSelectedSession(session: DeviceSession | undefined) {
    const previousSession = this.selectedDeviceSession;
    this.activeSessionId = session?.getState().deviceInfo.id;
    if (previousSession === session) {
      return;
    }
    if (session === undefined) {
      this.projectStateManager.setState({ selectedDeviceSessionId: null });
      this.deviceSessionManagerDelegate.onDeviceSessionsManagerStateChange(this.state);
      return;
    }
    await previousSession?.deactivate();
    await session.activate();
    extensionContext.workspaceState.update(LAST_SELECTED_DEVICE_KEY, this.activeSessionId);
    this.projectStateManager.setState({ selectedDeviceSessionId: this.activeSessionId });
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
    disposeAll([...this.deviceSessions.values().toArray(), ...this.disposables]);
  }
}
