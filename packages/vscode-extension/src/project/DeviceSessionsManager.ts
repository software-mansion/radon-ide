import { Disposable, window } from "vscode";
import _ from "lodash";
import { DeviceManager } from "../devices/DeviceManager";
import { DeviceAlreadyUsedError } from "../devices/DeviceAlreadyUsedError";
import { Logger } from "../Logger";
import { extensionContext } from "../utilities/extensionContext";
import { ApplicationContext } from "./ApplicationContext";
import { DeviceSession } from "./deviceSession";
import { disposeAll } from "../utilities/disposables";
import { DeviceId } from "../common/Project";
import { Connector } from "../connect/Connector";
import { OutputChannelRegistry } from "./OutputChannelRegistry";
import { StateManager } from "./StateManager";
import {
  DeviceInfo,
  DevicePlatform,
  DeviceRotation,
  DeviceSessions,
  DevicesState,
  generateInitialDeviceSessionStore,
  ProjectStore,
  REMOVE,
} from "../common/State";
import { DeviceBase } from "../devices/DeviceBase";

const LAST_SELECTED_DEVICE_KEY = "last_selected_device";
const SWITCH_DEVICE_THROTTLE_MS = 300;

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
  private get devices(): DeviceInfo[] {
    const devicesByType = this.devicesStateManager.getState().devicesByType;
    if (devicesByType === null) {
      return [];
    }
    return (
      ["iosSimulators", "androidEmulators", "androidPhysicalDevices"] as const
    ).flatMap<DeviceInfo>((deviceType) => devicesByType[deviceType] ?? []);
  }

  constructor(
    private readonly stateManager: StateManager<DeviceSessions>,
    // note: this manager is owned by the project
    private readonly projectStateManager: StateManager<ProjectStore>,
    private readonly applicationContext: ApplicationContext,
    private readonly deviceManager: DeviceManager,
    private readonly devicesStateManager: StateManager<DevicesState>,
    private deviceSessionManagerDelegate: DeviceSessionsManagerDelegate,
    private readonly outputChannelRegistry: OutputChannelRegistry
  ) {
    this.disposables.push(
      this.devicesStateManager.onSetState((partialState) => {
        const devices = partialState.devicesByType;
        if (devices !== undefined && devices !== null && devices !== REMOVE) {
          this.devicesChangedListener();
        }
      })
    );

    this.disposables.push(this.stateManager);
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
      this.projectStateManager.updateState({ deviceSessions: { [deviceId]: REMOVE } });
      await session.dispose();
    }
  }

  private get deviceLimits() {
    const stopPreviousDevices =
      this.applicationContext.workspaceConfiguration.deviceControl.stopPreviousDevices;
    const launchConfig = this.applicationContext.launchConfig;
    const usesSingleMetro = !!launchConfig.metroPort;
    const usesOldDevtools = launchConfig.useOldDevtools;
    const totalDeviceLimit =
      stopPreviousDevices || (usesSingleMetro && usesOldDevtools) ? 1 : Number.MAX_SAFE_INTEGER;
    const androidEmulatorLimit = usesSingleMetro ? 1 : Number.MAX_SAFE_INTEGER;
    return {
      totalDeviceLimit,
      [DevicePlatform.Android]: androidEmulatorLimit,
      [DevicePlatform.IOS]: Number.MAX_SAFE_INTEGER,
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

  public async terminateAllSessions() {
    const sessionEntries = Array.from(this.deviceSessions.entries());
    return Promise.all(
      sessionEntries.map(([deviceId, _session]) => this.terminateSession(deviceId))
    );
  }

  private async terminateSessionsOverLimit({ platform, id: deviceId }: DeviceInfo) {
    const samePlatformSessions = Object.entries(this.stateManager.getState()).filter(
      ([_id, session]) => {
        return session.deviceInfo.id !== deviceId && session.deviceInfo.platform === platform;
      }
    );
    const samePlatformDevicesToStop = Math.max(
      0,
      samePlatformSessions.length + 1 - this.deviceLimits[platform]
    );
    await Promise.all(
      samePlatformSessions
        .slice(0, samePlatformDevicesToStop)
        .map(([id]) => this.terminateSession(id))
    );

    const sessions = Object.entries(this.stateManager.getState()).filter(([_id, session]) => {
      return session.deviceInfo.id !== deviceId;
    });
    const devicesToStop = Math.max(0, sessions.length + 1 - this.deviceLimits.totalDeviceLimit);
    await Promise.all(sessions.slice(0, devicesToStop).map(([id]) => this.terminateSession(id)));
  }

  public async startOrActivateSessionForDevice(deviceInfo: DeviceInfo) {
    Connector.getInstance().disable();

    // if there's an existing session for the device, we use it instead of starting a new one
    const existingDeviceSession = this.deviceSessions.get(deviceInfo.id);
    if (existingDeviceSession) {
      this.updateSelectedSession(existingDeviceSession);
      await this.terminateSessionsOverLimit(deviceInfo);
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
      this.stateManager.updateState({
        [deviceInfo.id]: generateInitialDeviceSessionStore({ deviceInfo }),
      });
    }

    const newDeviceSession = new DeviceSession(
      this.stateManager.getDerived(deviceInfo.id),
      this.applicationContext,
      device,
      await this.applicationContext.devtoolsServer,
      this.deviceSessionManagerDelegate.getDeviceRotation(),
      this.outputChannelRegistry,
      this.applicationContext.metroProvider
    );

    this.deviceSessions.set(deviceInfo.id, newDeviceSession);
    this.maybeWarnAboutRunningDevices();
    this.updateSelectedSession(newDeviceSession);
    this.deviceSessionManagerDelegate.onInitialized();

    await this.terminateSessionsOverLimit(deviceInfo);

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
      (session) => session.platform === DevicePlatform.IOS
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
    if (!this.applicationContext.workspaceConfiguration.deviceControl.startDeviceOnLaunch) {
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

      const devices = this.devices;
      if (devices.length === 0) {
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
  private devicesChangedListener = async () => {
    const previousDevices = this.previousDevices;
    const devices = this.devices;

    const removedDevices = previousDevices.filter(
      (prevDevice) => !devices.some((device) => device.id === prevDevice.id)
    );

    const disconnectedDevices = devices.filter((d) => {
      return (
        !d.available && previousDevices.some((device) => device.id === d.id && device.available)
      );
    });

    if (removedDevices.length > 1) {
      Logger.warn(
        "Multiple devices were removed in one update, the results might be unpredictable. These devices were removed:",
        removedDevices
      );
    }

    // NOTE: stop removed devices and (unselected) disconnected physical devices
    const devicesToStop = removedDevices.concat(
      disconnectedDevices.filter((d) => d.id !== this.activeSessionId)
    );

    await Promise.all(
      devicesToStop.map((device) => {
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
    const previousSessionId = this.activeSessionId;
    this.activeSessionId = session?.id;
    if (previousSession === session) {
      return;
    }
    if (session === undefined) {
      this.projectStateManager.updateState({ selectedDeviceSessionId: null });
      return;
    }
    extensionContext.workspaceState.update(LAST_SELECTED_DEVICE_KEY, this.activeSessionId);
    this.projectStateManager.updateState({ selectedDeviceSessionId: this.activeSessionId });

    const wasPreviousDeviceDisconnected = !this.devices.find((d) => d.id === previousSessionId)
      ?.available;

    // NOTE: if previous device was already disconnected,
    // we terminate its session instead of deactivating it,
    // since after reconnecting it will need restarting anyway
    if (previousSessionId && wasPreviousDeviceDisconnected) {
      await this.terminateSession(previousSessionId);
    } else {
      await previousSession?.deactivate();
    }

    await session.activate();
  }

  private async acquireDeviceByDeviceInfo(deviceInfo: DeviceInfo) {
    if (!deviceInfo.available) {
      const message =
        deviceInfo.platform === DevicePlatform.Android && !deviceInfo.emulator
          ? "Selected device is not connected anymore. Please connect it to your computer and try again."
          : "Selected device is not available. Perhaps the system image it uses is not installed. Please select another device.";
      window.showErrorMessage(message, "Dismiss");
      return undefined;
    }
    let device: DeviceBase | undefined;
    try {
      device = await this.deviceManager.acquireDevice(
        deviceInfo,
        this.applicationContext.workspaceConfigState.getState().deviceSettings
      );
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

  clearState() {
    const currentState = this.stateManager.getState();
    const newState = _.mapValues(currentState, (): typeof REMOVE => REMOVE);
    this.stateManager.updateState(newState);
  }

  dispose() {
    // NOTE: we overwrite the delegate to avoid calling it during/after dispose
    this.deviceSessionManagerDelegate = {
      onInitialized: () => {},
      getDeviceRotation: () => DeviceRotation.Portrait,
    };
    const deviceSessions = this.deviceSessions.values().toArray();
    this.deviceSessions.clear();
    this.activeSessionId = undefined;
    this.clearState();
    disposeAll([...deviceSessions, ...this.disposables]);
  }
}
