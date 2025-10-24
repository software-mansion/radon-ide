import _ from "lodash";
import { Disposable } from "vscode";
import { getAndroidSystemImages } from "../utilities/sdkmanager";
import {
  SimulatorDeviceSet,
  createSimulator,
  renameIosSimulator,
  removeIosSimulator,
} from "./IosSimulatorDevice";
import { getAvailableIosRuntimes } from "../utilities/iosRuntimes";
import { createEmulator, renameEmulator, removeEmulator } from "./AndroidEmulatorDevice";
import { extensionContext } from "../utilities/extensionContext";
import { getTelemetryReporter } from "../utilities/telemetry";
import {
  AndroidSystemImageInfo,
  DeviceInfo,
  DevicePlatform,
  DevicesByType,
  DeviceSettings,
  DevicesState,
  IOSDeviceTypeInfo,
  IOSRuntimeInfo,
} from "../common/State";
import { StateManager } from "../project/StateManager";
import { disposeAll } from "../utilities/disposables";
import { DevicesProvider } from "./DevicesProvider";

const DEVICE_LIST_CACHE_KEY = "device_by_type_list_cache";

export class DeviceManager implements Disposable {
  private disposables: Disposable[] = [];

  constructor(
    private readonly stateManager: StateManager<DevicesState>,
    private readonly devicesProviders: DevicesProvider[]
  ) {
    this.loadDevicesIntoState();
    this.loadInstalledImages();

    this.disposables.push(this.stateManager);
  }

  public async acquireDevice(deviceInfo: DeviceInfo, deviceSettings: DeviceSettings) {
    for (const provider of this.devicesProviders) {
      const maybeDevice = await provider.acquireDevice(deviceInfo, deviceSettings);
      if (maybeDevice !== undefined) {
        return maybeDevice;
      }
    }
    throw new Error(`Device ${deviceInfo.displayName} is not available`);
  }

  private loadDevicesPromise: Promise<void> | undefined;

  public async loadDevices(forceReload = false) {
    if (forceReload) {
      // Clear the cache when force reload is requested
      extensionContext.globalState.update(DEVICE_LIST_CACHE_KEY, undefined);
    }
    if (!this.loadDevicesPromise || forceReload) {
      this.loadDevicesPromise = this.loadDevicesInternal().then(() => {
        const devices = this.stateManager.getState().devicesByType;
        this.loadDevicesPromise = undefined;
        // NOTE: only remember virtual devices,
        // since available physical devices are likely to change
        extensionContext.globalState.update(DEVICE_LIST_CACHE_KEY, devices);
      });
    }
    await this.loadDevicesPromise;
  }

  private async loadDevicesInternal() {
    await Promise.all(this.devicesProviders.map((p) => p.listDevices()));
  }

  private async listInstalledAndroidImages() {
    return getAndroidSystemImages();
  }

  private listInstalledIOSRuntimes() {
    return getAvailableIosRuntimes();
  }

  private async loadDevicesIntoState() {
    const devicesByType = extensionContext.globalState.get<DevicesByType>(DEVICE_LIST_CACHE_KEY);
    if (devicesByType) {
      // we still want to perform load here in case anything changes, just won't wait for it
      this.stateManager.updateState({ devicesByType });
      this.loadDevices();
    } else {
      await this.loadDevices();
    }
    // after the initial load, we want to keep the cache updated
    this.stateManager.onSetState((newState) => {
      extensionContext.globalState.update(DEVICE_LIST_CACHE_KEY, newState.devicesByType);
    });
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

    const devicesKey =
      device.platform === DevicePlatform.IOS ? "iosSimulators" : "androidEmulators";

    // This is an optimization to update before costly operations
    const previousDevices = this.stateManager.getState().devicesByType?.[devicesKey] ?? [];
    const devices = previousDevices.filter((d) => d.id !== device.id);
    this.stateManager.updateState({ devicesByType: { [devicesKey]: devices } });

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
