import _ from "lodash";
import { Disposable } from "vscode";
import { getAndroidSystemImages } from "../utilities/sdkmanager";
import {
  IosSimulatorDevice,
  SimulatorDeviceSet,
  createSimulator,
  listSimulators,
  renameIosSimulator,
  removeIosSimulator,
} from "./IosSimulatorDevice";
import { getAvailableIosRuntimes } from "../utilities/iosRuntimes";
import {
  AndroidEmulatorDevice,
  createEmulator,
  listEmulators,
  renameEmulator,
  removeEmulator,
} from "./AndroidEmulatorDevice";
import { Logger } from "../Logger";
import { extensionContext } from "../utilities/extensionContext";
import { Platform } from "../utilities/platform";
import { getTelemetryReporter } from "../utilities/telemetry";
import { OutputChannelRegistry } from "../project/OutputChannelRegistry";
import { checkXcodeExists } from "../utilities/checkXcodeExists";
import {
  AndroidSystemImageInfo,
  DeviceInfo,
  DevicePlatform,
  DeviceSettings,
  DevicesState,
  IOSDeviceTypeInfo,
  IOSRuntimeInfo,
} from "../common/State";
import { StateManager } from "../project/StateManager";
import { disposeAll } from "../utilities/disposables";
import { AndroidPhysicalDevice, listConnectedDevices } from "./AndroidPhysicalDevice";

const DEVICE_LIST_CACHE_KEY = "device_list_cache";

export class DeviceAlreadyUsedError extends Error {}
export class DeviceManager implements Disposable {
  private disposables: Disposable[] = [];

  constructor(
    private readonly stateManager: StateManager<DevicesState>,
    private readonly outputChannelRegistry: OutputChannelRegistry
  ) {
    this.loadDevicesIntoState();
    this.loadInstalledImages();

    this.disposables.push(this.stateManager);
  }

  public async acquireDevice(deviceInfo: DeviceInfo, deviceSettings: DeviceSettings) {
    if (deviceInfo.platform === DevicePlatform.IOS) {
      if (Platform.OS !== "macos") {
        throw new Error("Invalid platform. Expected macos.");
      }

      const simulators = await listSimulators(SimulatorDeviceSet.RN_IDE);
      const simulatorInfo = simulators.find((device) => device.id === deviceInfo.id);
      if (!simulatorInfo || simulatorInfo.platform !== DevicePlatform.IOS) {
        throw new Error(`Simulator ${deviceInfo.id} not found`);
      }
      const device = new IosSimulatorDevice(
        deviceSettings,
        simulatorInfo.UDID,
        simulatorInfo,
        this.outputChannelRegistry
      );
      if (await device.acquire()) {
        return device;
      } else {
        device.dispose();
      }
    } else if (!deviceInfo.emulator) {
      const device = new AndroidPhysicalDevice(
        deviceInfo,
        deviceSettings,
        this.outputChannelRegistry
      );
      if (await device.acquire()) {
        return device;
      } else {
        device.dispose();
      }
    } else {
      const emulators = await listEmulators();
      const emulatorInfo = emulators.find((device) => device.id === deviceInfo.id);
      if (!emulatorInfo || emulatorInfo.platform !== DevicePlatform.Android) {
        throw new Error(`Emulator ${deviceInfo.id} not found`);
      }
      const device = new AndroidEmulatorDevice(
        deviceSettings,
        emulatorInfo.avdId,
        emulatorInfo,
        this.outputChannelRegistry
      );
      if (await device.acquire()) {
        return device;
      } else {
        device.dispose();
      }
    }

    throw new DeviceAlreadyUsedError();
  }

  private loadDevicesPromise: Promise<DeviceInfo[]> | undefined;

  private async loadDevices(forceReload = false) {
    const previousDevices = extensionContext.globalState.get(DEVICE_LIST_CACHE_KEY) as
      | DeviceInfo[]
      | undefined;
    if (forceReload) {
      // Clear the cache when force reload is requested
      extensionContext.globalState.update(DEVICE_LIST_CACHE_KEY, undefined);
    }
    if (!this.loadDevicesPromise || forceReload) {
      this.loadDevicesPromise = this.loadDevicesInternal().then((devices) => {
        this.loadDevicesPromise = undefined;
        extensionContext.globalState.update(DEVICE_LIST_CACHE_KEY, devices);
        return devices;
      });
    }
    const devices = await this.loadDevicesPromise;
    if (!_.isEqual(previousDevices, devices)) {
      this.stateManager.updateState({ devices });
    }
    return devices;
  }

  private async loadDevicesInternal() {
    const physicalDevices = await listConnectedDevices();
    const emulators = listEmulators().catch((e) => {
      Logger.error("Error fetching emulators", e);
      return [];
    });

    let shouldLoadSimulators = Platform.OS === "macos";

    if (shouldLoadSimulators && !(await checkXcodeExists())) {
      shouldLoadSimulators = false;
      Logger.debug("Couldn't list iOS simulators as XCode installation wasn't found");
    }

    const simulators = shouldLoadSimulators
      ? listSimulators(SimulatorDeviceSet.RN_IDE).catch((e) => {
          Logger.error("Error fetching simulators", e);
          return [];
        })
      : Promise.resolve([]);
    const [androidDevices, iosDevices] = await Promise.all([emulators, simulators]);
    const devices = [...androidDevices, ...iosDevices, ...physicalDevices];
    return devices;
  }

  private async listInstalledAndroidImages() {
    return getAndroidSystemImages();
  }

  private listInstalledIOSRuntimes() {
    return getAvailableIosRuntimes();
  }

  private async loadDevicesIntoState() {
    const devices = extensionContext.globalState.get(DEVICE_LIST_CACHE_KEY) as
      | DeviceInfo[]
      | undefined;
    if (devices) {
      // we still want to perform load here in case anything changes, just won't wait for it
      this.loadDevices();
      this.stateManager.updateState({ devices });
    } else {
      return await this.loadDevices();
    }
  }

  public async createAndroidDevice(
    modelId: string,
    displayName: string,
    systemImage: AndroidSystemImageInfo
  ) {
    getTelemetryReporter().sendTelemetryEvent("device-manager:create-device", {
      platform: DevicePlatform.Android,
      systemName: String(systemImage.apiLevel),
    });

    const emulator = await createEmulator(modelId, displayName, systemImage);
    await this.loadDevices(true);
    return emulator;
  }

  public async createIOSDevice(
    deviceType: IOSDeviceTypeInfo,
    displayName: string,
    runtime: IOSRuntimeInfo
  ) {
    getTelemetryReporter().sendTelemetryEvent("device-manager:create-device", {
      platform: DevicePlatform.IOS,
      systemName: String(runtime.version),
    });

    const simulator = await createSimulator(
      deviceType.identifier,
      displayName,
      runtime,
      SimulatorDeviceSet.RN_IDE
    );
    await this.loadDevices(true);
    return simulator;
  }

  public loadInstalledImages() {
    this.listInstalledIOSRuntimes().then((runtimes) => {
      this.stateManager.updateState({
        iOSRuntimes: runtimes,
      });
    });
    this.listInstalledAndroidImages().then((images) => {
      this.stateManager.updateState({
        androidImages: images,
      });
    });
  }

  public async renameDevice(device: DeviceInfo, newDisplayName: string) {
    if (device.platform === DevicePlatform.IOS) {
      await renameIosSimulator(device.UDID, newDisplayName);
    }
    if (device.platform === DevicePlatform.Android && device.emulator) {
      await renameEmulator(device.avdId, newDisplayName);
    }
    await this.loadDevices();
  }

  public async removeDevice(device: DeviceInfo) {
    getTelemetryReporter().sendTelemetryEvent("device-manager:remove-device", {
      platform: device.platform,
      systemName: String(device.systemName),
    });

    // This is an optimization to update before costly operations
    const previousDevices = this.stateManager.getState().devices ?? [];
    const devices = previousDevices.filter((d) => d.id !== device.id);
    this.stateManager.updateState({ devices });

    if (device.platform === DevicePlatform.IOS) {
      await removeIosSimulator(device.UDID, SimulatorDeviceSet.RN_IDE);
    }
    if (device.platform === DevicePlatform.Android && device.emulator) {
      await removeEmulator(device.avdId);
    }

    // Load devices anyway to ensure the state is up-to-date
    await this.loadDevices();
  }

  dispose() {
    disposeAll(this.disposables);
  }
}
