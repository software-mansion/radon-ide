import { getAppCachesDir } from "../utilities/common";
import { ExtensionContext } from "vscode";
import { DeviceBase, DeviceSettings } from "./DeviceBase";
import { Preview } from "./preview";
import { Logger } from "../Logger";
import { command, exec } from "../utilities/subprocess";
import { getAvailableIosRuntimes } from "../utilities/iosRuntimes";

const path = require("path");
const fs = require("fs");

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

export interface RuntimeInfo {
  bundlePath: string;
  buildversion: string;
  platform: "iOS" | "tvOS" | "watchOS";
  runtimeRoot: string;
  identifier: string;
  version: string;
  isInternal: boolean;
  isAvailable: boolean;
  name: string;
  supportedDeviceTypes: Array<{ name: string; identifier: string }>;
}

interface DeviceTypeInfo {
  productFamily: "iPhone" | "iPad" | "Apple Watch" | "Apple TV";
  bundlePath: string;
  maxRuntimeVersion: number;
  maxRuntimeVersionString: string;
  identifier: string;
  modelIdentifier: string;
  minRuntimeVersion: number;
  minRuntimeVersionString: string;
  name: string;
}

interface SimulatorData {
  devices: { [index: string]: Array<SimulatorInfo> };
}

export class IosSimulatorDevice extends DeviceBase {
  private deviceUdid: string | undefined;
  private deviceSetPath = getOrCreateDeviceSet();

  constructor(private context: ExtensionContext) {
    super();
  }

  get name(): string | undefined {
    return this.deviceUdid;
  }

  get deviceSet(): string {
    return this.deviceSetPath;
  }

  async bootDevice(runtime: RuntimeInfo, udid?: string) {
    this.deviceUdid = await findOrCreateSimulator(this.deviceSetPath, runtime, udid);
    return this.deviceUdid;
  }

  async changeSettings(settings: DeviceSettings) {
    await exec("xcrun", [
      "simctl",
      "--set",
      this.deviceSetPath,
      "ui",
      this.deviceUdid!,
      "appearance",
      settings.appearance,
    ]);
    await exec("xcrun", [
      "simctl",
      "--set",
      this.deviceSetPath,
      "ui",
      this.deviceUdid!,
      "content_size",
      convertToSimctlSize(settings.contentSize),
    ]);
  }

  async configureMetroPort(bundleID: string, metroPort: number) {
    const { stdout: appDataLocation } = await exec("xcrun", [
      "simctl",
      "--set",
      this.deviceSetPath,
      "get_app_container",
      this.deviceUdid!,
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

  async launchApp(bundleID: string, metroPort: number) {
    await this.configureMetroPort(bundleID, metroPort);
    await exec("xcrun", [
      "simctl",
      "--set",
      this.deviceSetPath,
      "launch",
      "--terminate-running-process",
      this.deviceUdid!,
      bundleID,
    ]);
  }

  async installApp(appPath: string) {
    await exec("xcrun", [
      "simctl",
      "--set",
      this.deviceSetPath,
      "install",
      this.deviceUdid!,
      appPath,
    ]);
  }

  makePreview(): Preview {
    return new Preview(this.context, ["ios", this.deviceUdid!, this.deviceSetPath]);
  }
}

export async function getNewestAvailableIosRuntime() {
  const runtimesData = await getAvailableIosRuntimes();

  // sort available runtimes by version
  runtimesData.sort((a, b) => (a.version.localeCompare(b.version) ? -1 : 1));

  // pick the newest runtime
  return runtimesData[0];
}

export async function removeIosRuntimes(runtimes: RuntimeInfo[]) {
  const removalPromises = runtimes.map((runtime) => {
    return exec("xcrun", ["simctl", "runtime", "delete", runtime.buildversion], {});
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

async function getNewestNonProIPhone() {
  const deviceTypesData: { devicetypes: Array<DeviceTypeInfo> } = JSON.parse(
    (await command(`xcrun simctl list devicetypes --json`)).stdout
  );

  // filter iPhones:
  const iphones = deviceTypesData.devicetypes.filter((deviceType) => {
    // exclude phones with names that contains Pro/SE/Plus
    return deviceType.productFamily === "iPhone" && deviceType.name.match(/Pro/);
  });

  // select iPhone with highest minRuntimeVersion
  iphones.sort((a, b) => (a.minRuntimeVersion > b.minRuntimeVersion ? -1 : 1));
  return iphones[0];
}

async function getSimulators(deviceSetLocation: string): Promise<Array<SimulatorInfo>> {
  const { stdout } = await exec("xcrun", [
    "simctl",
    "--set",
    deviceSetLocation,
    "list",
    "devices",
    "--json",
  ]);
  const parsedData: SimulatorData = JSON.parse(stdout);
  const allDevices = Object.keys(parsedData.devices)
    .map((key) => parsedData.devices[key])
    .reduce((acc, val) => acc.concat(val), [])
    .filter((device) => device.isAvailable);

  return allDevices;
}

async function getSimulatorWithUdid(deviceSetLocation: string, udid?: string) {
  if (!udid) {
    return undefined;
  }
  const allDevices = await getSimulators(deviceSetLocation);
  return allDevices.find((device) => device.udid === udid);
}

async function getPreferredSimulator(deviceSetLocation: string) {
  const allDevices = await getSimulators(deviceSetLocation);

  return allDevices.length ? allDevices[0] : undefined;
}

async function findOrCreateSimulator(
  deviceSetLocation: string,
  runtime: RuntimeInfo,
  udid?: string
) {
  let simulator = await getSimulatorWithUdid(deviceSetLocation, udid);
  if (simulator && simulator.state === "Booted") {
    // this simulator is ok to be used
    return simulator.udid;
  }

  if (!simulator) {
    // we need to create a new simulator
    const deviceType = await getNewestNonProIPhone();

    Logger.debug(`Create simulator ${deviceType.name} with runtime ${runtime.name}`);
    // create new simulator with selected runtime
    const { stdout: newUdid } = await exec("xcrun", [
      "simctl",
      "--set",
      deviceSetLocation,
      "create",
      "ReactNativePreviewVSCode",
      deviceType.identifier,
      runtime.identifier,
    ]);

    simulator = await getSimulatorWithUdid(deviceSetLocation, newUdid)!;
  }

  // for new simulator or old one that's not booted, we try booting it
  await exec("xcrun", ["simctl", "--set", deviceSetLocation, "boot", simulator!.udid]);
  return simulator!.udid;
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
