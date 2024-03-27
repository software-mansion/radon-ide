import { getAppCachesDir } from "../utilities/common";
import { DeviceBase } from "./DeviceBase";
import { Preview } from "./preview";
import { Logger } from "../Logger";
import { exec } from "../utilities/subprocess";
import { getAvailableIosRuntimes } from "../utilities/iosRuntimes";
import { DeviceInfo, IOSDeviceTypeInfo, IOSRuntimeInfo, Platform } from "../common/DeviceManager";
import { BuildResult, IOSBuildResult } from "../builders/BuildManager";
import path from "path";
import fs from "fs";
import http from "http";
import { DeviceSettings } from "../common/Project";
import { downloadIOSExpoGo, getIOSExpoGoAppPath } from "../builders/expoGo";

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

// TODO: move expo deeplink choice and fetchExpoLaunchDeeplink to separate files
type ExpoDeeplinkChoice = "expo-go" | "expo-dev-client";

export class IosSimulatorDevice extends DeviceBase {
  constructor(private readonly deviceUDID: string) {
    super();
  }

  public dispose() {
    super.dispose();
    return exec("xcrun", ["simctl", "--set", getOrCreateDeviceSet(), "shutdown", this.deviceUDID]);
  }

  async bootDevice() {
    const deviceSetLocation = getOrCreateDeviceSet();
    try {
      await exec("xcrun", ["simctl", "--set", deviceSetLocation, "boot", this.deviceUDID], {
        allowNonZeroExit: true,
      });
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
      await exec(
        "/usr/libexec/PlistBuddy",
        [
          "-c",
          "Delete :RCT_jsLocation",
          "-c",
          `Add :RCT_jsLocation string localhost:${metroPort}`,
          userDefaultsLocation,
        ],
        { allowNonZeroExit: true }
      );
    } catch (e) {
      // Delete command fails if the key doesn't exists, but later commands run regardless,
      // despite that process exits with non-zero code. We can ignore this error.
    }
  }

  async launchWithBuild(build: IOSBuildResult) {
    const deviceSetLocation = getOrCreateDeviceSet();
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

  async launchWithExpoDeeplink(build: IOSBuildResult, expoDeeplink: string) {
    // For Expo dev-client and Expo Go setup, we use deeplink to launch the app. For this approach to work we do the following:
    // 1. Add the deeplink to the scheme approval list
    // 2. Terminate the app if it's running
    // 3. Open the deeplink
    const deviceSetLocation = getOrCreateDeviceSet();

    // Add the deeplink to the scheme approval list:
    const schema = new URL(expoDeeplink).protocol.slice(0, -1);
    await exec("/usr/libexec/PlistBuddy", [
      "-c",
      "Clear dict",
      "-c",
      `Add :com.apple.CoreSimulator.CoreSimulatorBridge-->${schema} string ${build.bundleID}`,
      path.join(
        deviceSetLocation,
        this.deviceUDID,
        "data",
        "Library",
        "Preferences",
        "com.apple.launchservices.schemeapproval.plist"
      ),
    ]);

    // Terminate the app if it's running:
    try {
      await exec(
        "xcrun",
        ["simctl", "--set", deviceSetLocation, "terminate", this.deviceUDID, build.bundleID],
        { allowNonZeroExit: true }
      );
    } catch (e) {
      // terminate will exit with non-zero code when the app wasn't running. we ignore this error
    }

    // Use openurl to open the deeplink:
    await exec("xcrun", [
      "simctl",
      "--set",
      deviceSetLocation,
      "openurl",
      this.deviceUDID,
      expoDeeplink,
      // TODO: disableOnboarding param causes error while launching
      // + "&disableOnboarding=1", // disable onboarding dialog via deeplink query param
    ]);
  }

  async launchApp(build: BuildResult, metroPort: number) {
    if (build.platform !== Platform.IOS) {
      throw new Error("Invalid platform");
    }
    const deepLinkChoice = build.isExpoGo ? "expo-go" : "expo-dev-client";
    const expoDeeplink = await fetchExpoLaunchDeeplink(metroPort, "ios", deepLinkChoice);
    if (expoDeeplink) {
      this.launchWithExpoDeeplink(build, expoDeeplink);
    } else {
      await this.configureMetroPort(build.bundleID, metroPort);
      this.launchWithBuild(build);
    }
  }

  async installApp(build: BuildResult, forceReinstall: boolean) {
    if (build.platform !== Platform.IOS) {
      throw new Error("Invalid platform");
    }
    const deviceSetLocation = getOrCreateDeviceSet();
    if (forceReinstall) {
      try {
        await exec(
          "xcrun",
          ["simctl", "--set", deviceSetLocation, "uninstall", this.deviceUDID, build.bundleID],
          { allowNonZeroExit: true }
        );
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

  async getExpoGoAppBuild(): Promise<IOSBuildResult> {
    if (!fs.existsSync(getIOSExpoGoAppPath())) {
      Logger.debug("Downloading Expo Go app");
      await downloadIOSExpoGo();
    }

    const build: IOSBuildResult = {
      appPath: getIOSExpoGoAppPath(),
      bundleID: "host.exp.Exponent",
      platform: Platform.IOS,
      isExpoGo: true,
    };
    return build;
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

export async function listSimulators(): Promise<DeviceInfo[]> {
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

  const simulators: DeviceInfo[] = Object.entries(devicesPerRuntime)
    .map(([runtimeID, devices]) => {
      const runtime = runtimes.find((runtime) => runtime.identifier === runtimeID);

      return devices.map((device) => {
        return {
          id: `ios-${device.udid}`,
          platform: Platform.IOS,
          UDID: device.udid,
          name: device.name,
          systemName: runtime?.name ?? "Unknown",
          available: device.isAvailable ?? false,
        } as DeviceInfo;
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

export function fetchExpoLaunchDeeplink(
  metroPort: number,
  platformString: string,
  choice: ExpoDeeplinkChoice
) {
  return new Promise<string | void>((resolve, reject) => {
    const req = http.request(
      new URL(
        `http://localhost:${metroPort}/_expo/link?platform=${platformString}&choice=${choice}`
      ),
      (res) => {
        if (res.statusCode === 307) {
          // we want to retrieve redirect location
          resolve(res.headers.location);
        } else {
          resolve();
        }
        res.resume();
      }
    );
    req.on("error", (e) => {
      // we still want to resolve on error, because the URL may not exists, in which
      // case it serves as a mechanism for detecting non expo-dev-client setups
      resolve();
    });
    req.end();
  });
}
