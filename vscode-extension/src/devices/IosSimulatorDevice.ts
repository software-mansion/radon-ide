import { getAppCachesDir } from "../utilities/common";
import { DeviceBase } from "./DeviceBase";
import { Preview } from "./preview";
import { Logger } from "../Logger";
import { exec } from "../utilities/subprocess";
import { getAvailableIosRuntimes } from "../utilities/iosRuntimes";
import { DeviceInfo, IOSDeviceTypeInfo, IOSRuntimeInfo, Platform } from "../common/DeviceManager";
import { BuildResult } from "../builders/BuildManager";
import path from "path";
import fs from "fs";
import { DeviceSettings } from "../common/Project";

interface SimulatorInfo {
  availability?: string;
  state?: string;
  isAvailable?: boolean;
  name: string;
  udid: string;
  version?: string;
  availabilityError?: string;
  type?: "simulator" | "device" | "catalyst";
  booted?: boolean;
  lastBootedAt?: string;
}

interface SimulatorData {
  devices: { [runtimeID: string]: SimulatorInfo[] };
}

export class IosSimulatorDevice extends DeviceBase {
  private readonly _deviceInfo: DeviceInfo;

  constructor(
    private readonly deviceUDID: string,
    displayName: string,
    systemName: string,
    available: boolean
  ) {
    super();
    this._deviceInfo = {
      id: `ios-${deviceUDID}`,
      platform: Platform.IOS,
      UDID: deviceUDID,
      name: displayName,
      systemName,
      available,
    };
  }

  get deviceInfo() {
    return this._deviceInfo;
  }

  async bootDevice() {
    const deviceSetLocation = getOrCreateDeviceSet();
    try {
      await exec("xcrun", ["simctl", "--set", deviceSetLocation, "boot", this.deviceUDID]);
    } catch (e) {
      // @ts-ignore
      if (e.stderr?.includes("current state: Booted")) {
        Logger.debug("Device already booted");
      } else {
        throw e;
      }
    }
  }

  async changeSettings(settings: DeviceSettings) {
    const deviceSetLocation = getOrCreateDeviceSet();
    await exec("xcrun", [
      "simctl",
      "--set",
      deviceSetLocation,
      "ui",
      this.deviceUDID,
      "appearance",
      settings.appearance,
    ]);
    await exec("xcrun", [
      "simctl",
      "--set",
      deviceSetLocation,
      "ui",
      this.deviceUDID,
      "content_size",
      convertToSimctlSize(settings.contentSize),
    ]);
  }

  async configureMetroPort(bundleID: string, metroPort: number) {
    const deviceSetLocation = getOrCreateDeviceSet();
    const { stdout: appDataLocation } = await exec("xcrun", [
      "simctl",
      "--set",
      deviceSetLocation,
      "get_app_container",
      this.deviceUDID,
      bundleID,
      "data",
    ]);
    const userDefaultsLocation = path.join(
      appDataLocation,
      "Library",
      "Preferences",
      `${bundleID}.plist`
    );
    Logger.debug(`Defaults location ${userDefaultsLocation}`);
    try {
      await exec("/usr/libexec/PlistBuddy", [
        "-c",
        `Add :RCT_jsLocation string localhost:${metroPort}`,
        userDefaultsLocation,
      ]);
    } catch (e) {
      await exec("/usr/libexec/PlistBuddy", [
        "-c",
        `Set :RCT_jsLocation localhost:${metroPort}`,
        userDefaultsLocation,
      ]);
    }
  }

  async launchApp(build: BuildResult, metroPort: number) {
    if (build.platform !== Platform.IOS) {
      throw new Error("Invalid platform");
    }
    const deviceSetLocation = getOrCreateDeviceSet();
    await this.configureMetroPort(build.bundleID, metroPort);
    await exec("xcrun", [
      "simctl",
      "--set",
      deviceSetLocation,
      "launch",
      "--terminate-running-process",
      this.deviceUDID,
      build.bundleID,
    ]);
  }

  async installApp(build: BuildResult, forceReinstall: boolean) {
    if (build.platform !== Platform.IOS) {
      throw new Error("Invalid platform");
    }
    const deviceSetLocation = getOrCreateDeviceSet();
    if (forceReinstall) {
      try {
        await exec("xcrun", [
          "simctl",
          "--set",
          deviceSetLocation,
          "uninstall",
          this.deviceUDID,
          build.bundleID,
        ]);
      } catch (e) {
        Logger.error("Error while uninstalling will be ignored", e);
      }
    }
    await exec("xcrun", [
      "simctl",
      "--set",
      deviceSetLocation,
      "install",
      this.deviceUDID,
      build.appPath,
    ]);
  }

  makePreview(): Preview {
    return new Preview(["ios", this.deviceUDID, getOrCreateDeviceSet()]);
  }
}

export async function getNewestAvailableIosRuntime() {
  const runtimesData = await getAvailableIosRuntimes();

  // sort available runtimes by version
  runtimesData.sort((a, b) => (a.version.localeCompare(b.version) ? -1 : 1));

  // pick the newest runtime
  return runtimesData[0];
}

export async function removeIosRuntimes(runtimeIDs: string[]) {
  const removalPromises = runtimeIDs.map((runtimeID) => {
    return exec("xcrun", ["simctl", "runtime", "delete", runtimeID], {});
  });
  return Promise.all(removalPromises);
}

export async function removeIosSimulator(udid?: string) {
  if (!udid) {
    return;
  }

  const setDirectory = getOrCreateDeviceSet();

  return exec("xcrun", ["simctl", "--set", setDirectory, "delete", udid]);
}

export async function listSimulators() {
  const deviceSetLocation = getOrCreateDeviceSet();
  const { stdout } = await exec("xcrun", [
    "simctl",
    "--set",
    deviceSetLocation,
    "list",
    "devices",
    "--json",
  ]);
  const parsedData: SimulatorData = JSON.parse(stdout);

  const { devices: devicesPerRuntime } = parsedData;
  const runtimes = await getAvailableIosRuntimes();

  const simulators: IosSimulatorDevice[] = Object.entries(devicesPerRuntime)
    .map(([runtimeID, devices]) => {
      const runtime = runtimes.find((runtime) => runtime.identifier === runtimeID);

      return devices.map((device) => {
        return new IosSimulatorDevice(
          device.udid,
          device.name,
          runtime?.name ?? "Unknown",
          device.isAvailable ?? false
        );
      });
    })
    .flat();

  return simulators;
}

export async function createSimulator(deviceType: IOSDeviceTypeInfo, runtime: IOSRuntimeInfo) {
  Logger.debug(`Create simulator ${deviceType.identifier} with runtime ${runtime.identifier}`);
  const deviceSetLocation = getOrCreateDeviceSet();
  // create new simulator with selected runtime
  const { stdout: UDID } = await exec("xcrun", [
    "simctl",
    "--set",
    deviceSetLocation,
    "create",
    deviceType.name,
    deviceType.identifier,
    runtime.identifier,
  ]);

  return {
    id: `ios-${UDID}`,
    platform: Platform.IOS,
    UDID,
    name: deviceType.name,
    systemName: runtime.name,
    available: true, // assuming if create command went through, it's available
  } as DeviceInfo;
}

function getOrCreateDeviceSet() {
  const appCachesDir = getAppCachesDir();
  const deviceSetLocation = path.join(appCachesDir, "Devices", "iOS");
  if (!fs.existsSync(deviceSetLocation)) {
    fs.mkdirSync(deviceSetLocation, { recursive: true });
  }

  return deviceSetLocation;
}

function convertToSimctlSize(size: DeviceSettings["contentSize"]): string {
  switch (size) {
    case "xsmall":
      return "extra-small";
    case "small":
      return "small";
    case "normal":
      return "medium";
    case "large":
      return "large";
    case "xlarge":
      return "extra-large";
    case "xxlarge":
      return "extra-extra-large";
    case "xxxlarge":
      return "extra-extra-extra-large";
  }
}
