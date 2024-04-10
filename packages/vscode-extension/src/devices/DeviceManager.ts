import { getAndroidSystemImages } from "../utilities/sdkmanager";
import {
  IosSimulatorDevice,
  createSimulator,
  listSimulators,
  removeIosSimulator,
} from "./IosSimulatorDevice";
import { getAvailableIosRuntimes } from "../utilities/iosRuntimes";
import {
  AndroidEmulatorDevice,
  createEmulator,
  listEmulators,
  removeEmulator,
} from "./AndroidEmulatorDevice";
import {
  DeviceInfo,
  Platform,
  DeviceManagerInterface,
  IOSRuntimeInfo,
  DeviceManagerEventMap,
  DeviceManagerEventListener,
  IOSDeviceTypeInfo,
  AndroidSystemImageInfo,
} from "../common/DeviceManager";
import { EventEmitter } from "stream";
import { Disposable } from "vscode";
import { Logger } from "../Logger";
import { extensionContext } from "../utilities/extensionContext";

const DEVICE_LIST_CACHE_KEY = "device_list_cache";

export class DeviceManager implements Disposable, DeviceManagerInterface {
  private eventEmitter = new EventEmitter();

  public dispose() {}

  public async addListener<K extends keyof DeviceManagerEventMap>(
    eventType: K,
    listener: DeviceManagerEventListener<K>
  ) {
    this.eventEmitter.addListener(eventType, listener);
  }

  public async removeListener<K extends keyof DeviceManagerEventMap>(
    eventType: K,
    listener: DeviceManagerEventListener<K>
  ) {
    this.eventEmitter.removeListener(eventType, listener);
  }

  public async getDevice(deviceInfo: DeviceInfo) {
    if (deviceInfo.platform === Platform.IOS) {
      const simulators = await listSimulators();
      const simulatorInfo = simulators.find((device) => device.id === deviceInfo.id);
      if (!simulatorInfo || simulatorInfo.platform !== Platform.IOS) {
        throw new Error(`Simulator ${deviceInfo.id} not found`);
      }
      return new IosSimulatorDevice(simulatorInfo.UDID);
    } else {
      const emulators = await listEmulators();
      const emulatorInfo = emulators.find((device) => device.id === deviceInfo.id);
      if (!emulatorInfo || emulatorInfo.platform !== Platform.Android) {
        throw new Error(`Emulator ${deviceInfo.id} not found`);
      }
      return new AndroidEmulatorDevice(emulatorInfo.avdId);
    }
  }

  private loadDevicesPromise: Promise<DeviceInfo[]> | undefined;

  private async loadDevices(forceReload = false) {
    if (forceReload) {
      // Clear the cache when force reload is requested
      extensionContext.workspaceState.update(DEVICE_LIST_CACHE_KEY, undefined);
    }
    if (!this.loadDevicesPromise || forceReload) {
      this.loadDevicesPromise = this.loadDevicesInternal().then((devices) => {
        this.loadDevicesPromise = undefined;
        extensionContext.workspaceState.update(DEVICE_LIST_CACHE_KEY, devices);
        return devices;
      });
    }
    return this.loadDevicesPromise;
  }

  private async loadDevicesInternal() {
    const emulators = listEmulators().catch((e) => {
      Logger.error("Error fetching emulators", e);
      return [];
    });
    const simulators = listSimulators().catch((e) => {
      Logger.error("Error fetching simulators", e);
      return [];
    });
    const [androidDevices, iosDevices] = await Promise.all([emulators, simulators]);
    const devices = [...androidDevices, ...iosDevices];
    this.eventEmitter.emit("devicesChanged", devices);
    return devices;
  }

  public async listInstalledAndroidImages() {
    return getAndroidSystemImages();
  }

  public listInstalledIOSRuntimes() {
    return getAvailableIosRuntimes();
  }

  public async listAllDevices() {
    const devices = extensionContext.workspaceState.get(DEVICE_LIST_CACHE_KEY) as
      | DeviceInfo[]
      | undefined;
    if (devices) {
      // we still want to perform load here in case anything changes, just won't wait for it
      this.loadDevices();
      return devices;
    } else {
      return await this.loadDevices();
    }
  }

  public async createAndroidDevice(displayName: string, systemImage: AndroidSystemImageInfo) {
    const emulator = await createEmulator(displayName, systemImage);
    await this.loadDevices(true);
    return emulator;
  }

  public async createIOSDevice(deviceType: IOSDeviceTypeInfo, runtime: IOSRuntimeInfo) {
    const simulator = await createSimulator(deviceType, runtime);
    await this.loadDevices(true);
    return simulator;
  }

  public async removeDevice(device: DeviceInfo) {
    if (device.platform === Platform.IOS) {
      await removeIosSimulator(device.UDID);
    }
    if (device.platform === Platform.Android) {
      await removeEmulator(device.avdId);
    }
    await this.loadDevices();
    this.eventEmitter.emit("deviceRemoved", device);
  }
}
