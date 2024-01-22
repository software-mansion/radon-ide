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
      const simulator = simulators.find((simulator) => simulator.deviceInfo.id === deviceInfo.id);
      if (!simulator) {
        throw new Error(`Simulator ${deviceInfo.id} not found`);
      }
      return simulator;
    } else {
      const emulators = await listEmulators();
      const emulator = emulators.find((emulator) => emulator.deviceInfo.id === deviceInfo.id);
      if (!emulator) {
        throw new Error(`Emulator ${deviceInfo.id} not found`);
      }
      return emulator;
    }
  }

  private loadDevicesPromise: Promise<(IosSimulatorDevice | AndroidEmulatorDevice)[]> | undefined;

  private async loadDevices(forceReload = false) {
    if (!this.loadDevicesPromise || forceReload) {
      this.loadDevicesPromise = this.loadDevicesInternal().then((devices) => {
        this.loadDevicesPromise = undefined;
        return devices;
      });
    }
    return this.loadDevicesPromise;
  }

  /**
   * TODO: loadDevices should actually return DeviceInfo[]
   */
  private async loadDevicesInternal() {
    const [androidDevices, iosDevices] = await Promise.all([listEmulators(), listSimulators()]);
    const devices = [...androidDevices, ...iosDevices];
    this.eventEmitter.emit(
      "devicesChanged",
      devices.map((device) => device.deviceInfo)
    );
    return devices;
  }

  public async listInstalledAndroidImages() {
    const [installedImages] = await getAndroidSystemImages();
    return installedImages;
  }

  public async listAllAndroidImages() {
    const [installedImages, availableImages] = await getAndroidSystemImages();
    return {
      installed: installedImages,
      available: availableImages,
    };
  }

  public listInstalledIOSRuntimes() {
    return getAvailableIosRuntimes() as Promise<IOSRuntimeInfo[]>;
  }

  public async listAllDevices() {
    return (await this.loadDevices()).map((device) => device.deviceInfo);
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
  }
}
