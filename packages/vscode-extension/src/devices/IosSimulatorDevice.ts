import path from "path";
import fs from "fs";
import { ExecaChildProcess, ExecaError } from "execa";
import mime from "mime";
import { getAppCachesDir, getOldAppCachesDir } from "../utilities/common";
import { DeviceBase } from "./DeviceBase";
import { Preview } from "./preview";
import { Logger } from "../Logger";
import { exec, lineReader } from "../utilities/subprocess";
import { getAvailableIosRuntimes } from "../utilities/iosRuntimes";
import { BuildResult } from "../builders/BuildManager";
import { AppPermissionType, DeviceSettings, Locale } from "../common/Project";
import { EXPO_GO_BUNDLE_ID, fetchExpoLaunchDeeplink } from "../builders/expoGo";
import { IOSBuildResult } from "../builders/buildIOS";
import { OutputChannelRegistry } from "../project/OutputChannelRegistry";
import { Output } from "../common/OutputChannel";
import {
  DeviceInfo,
  DevicePlatform,
  DeviceType,
  IOSDeviceInfo,
  IOSRuntimeInfo,
} from "../common/State";
import { SimCtl } from "../utilities/simctl";

export class IosSimulatorDevice extends DeviceBase {
  private runningAppProcess: ExecaChildProcess | undefined;
  private simCtl: SimCtl;

  constructor(
    private readonly deviceUDID: string,
    private readonly _deviceInfo: DeviceInfo,
    private readonly outputChannelRegistry: OutputChannelRegistry
  ) {
    super();
    this.simCtl = new SimCtl(this.deviceUDID, getOrCreateDeviceSet(this.deviceUDID));
  }

  public get platform(): DevicePlatform {
    return DevicePlatform.IOS;
  }

  public get deviceInfo() {
    return this._deviceInfo;
  }

  public get lockFilePath(): string {
    const deviceSetLocation = this.simCtl.deviceSetLocation;
    const pidFile = path.join(deviceSetLocation, this.deviceUDID, "lock.pid");
    return pidFile;
  }

  private get nativeLogsOutputChannel() {
    return this.outputChannelRegistry.getOrCreateOutputChannel(Output.IosDevice);
  }

  public dispose() {
    super.dispose();
    this.runningAppProcess?.cancel();
    this.simCtl.shutdown();
  }

  public async reboot() {
    super.reboot();
    this.runningAppProcess?.cancel();
    try {
      await this.simCtl.shutdown();
    } catch (e) {
      const isAlreadyShutdown = (e as ExecaError).stderr?.includes("current state: Shutdown");
      if (!isAlreadyShutdown) {
        throw e;
      }
    }
    await this.internalBootDevice();
  }

  public setUpKeyboard() {
    this.preview?.setUpKeyboard();
  }

  private async internalBootDevice() {
    try {
      await this.simCtl.boot();
    } catch (e) {
      const isAlreadyBooted = (e as ExecaError).stderr?.includes("current state: Booted");
      if (isAlreadyBooted) {
        Logger.debug("Device already booted");
      } else {
        throw e;
      }
    }
  }

  async bootDevice() {
    if (await this.shouldUpdateLocale(this.deviceSettings.locale)) {
      await this.changeLocale(this.deviceSettings.locale);
    }

    await this.internalBootDevice();

    await this.changeSettings(this.deviceSettings);
  }

  private async shouldUpdateLocale(locale: Locale): Promise<boolean> {
    const deviceSetLocation = this.simCtl.deviceSetLocation;
    const deviceLocale = await exec("/usr/libexec/PlistBuddy", [
      "-c",
      `print :AppleLocale`,
      path.join(
        deviceSetLocation,
        this.deviceUDID,
        "data",
        "Library",
        "Preferences",
        ".GlobalPreferences.plist"
      ),
    ]);
    if (deviceLocale.stdout === locale) {
      return false;
    }
    return true;
  }

  async changeSettings(settings: DeviceSettings): Promise<boolean> {
    let shouldRestart = false;

    if (await this.shouldUpdateLocale(settings.locale)) {
      shouldRestart = true;
      this.changeLocale(settings.locale);
    }

    await this.simCtl.setAppearance(settings.appearance);
    await this.simCtl.setContentSize(settings.contentSize);
    await this.simCtl.setLocation(settings.location);
    await this.simCtl.notifyBiometricEnrollmentChanged(settings.hasEnrolledBiometrics);

    return shouldRestart;
  }

  async sendBiometricAuthorization(isMatch: boolean) {
    this.simCtl.sendBiometricAuthorization(isMatch);
  }

  public async sendClipboard(text: string) {
    await this.simCtl.clipboardCopy(text);
  }

  public async getClipboard() {
    return await this.simCtl.clipboardPaste();
  }

  private async changeLocale(newLocale: Locale): Promise<boolean> {
    const deviceSetLocation = this.simCtl.deviceSetLocation;
    const languageCode = newLocale.match(/([^_-]*)/)![1];
    await exec("/usr/libexec/PlistBuddy", [
      "-c",
      `set :AppleLanguages:0 ${languageCode}`,
      "-c",
      `set :AppleLocale ${newLocale}`,
      path.join(
        deviceSetLocation,
        this.deviceUDID,
        "data",
        "Library",
        "Preferences",
        ".GlobalPreferences.plist"
      ),
    ]);
    return true;
  }

  async configureMetroPort(bundleID: string, metroPort: number) {
    const appDataLocation = await this.simCtl.getAppContainer(bundleID, "data");
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

  public async terminateApp(bundleID: string) {
    // Terminate the app if it's running:
    try {
      this.simCtl.terminateApp(bundleID);
    } catch (e) {
      // terminate will exit with non-zero code when the app wasn't running. we ignore this error
    }
  }

  /**
   * This function terminates any running applications. Might be useful when you launch a new application
   * before terminating the previous one.
   */
  async terminateAnyRunningApplications() {
    const runningApps = await this.simCtl.listApps();

    const regex = /ApplicationType = User;\s*[^{}]*?\bCFBundleIdentifier = "([^"]+)/g;

    const matches = [];
    let match;
    while ((match = regex.exec(runningApps)) !== null) {
      matches.push(match[1]);
    }

    await Promise.all(matches.map(async (e) => await this.terminateApp(e)));
  }

  async launchWithBuild(build: IOSBuildResult, launchArguments: string[]) {
    await this.terminateAnyRunningApplications();

    if (this.runningAppProcess) {
      this.runningAppProcess.kill(9);
    }

    this.nativeLogsOutputChannel.clear();

    this.runningAppProcess = this.simCtl.launchApp(build.bundleID, launchArguments);
    lineReader(this.runningAppProcess).onLineRead((line) =>
      this.nativeLogsOutputChannel?.appendLine(line)
    );
  }

  async launchWithExpoDeeplink(bundleID: string, expoDeeplink: string) {
    // For Expo dev-client and Expo Go setup, we use deeplink to launch the app. For this approach to work we do the following:
    // 1. Add the deeplink to the scheme approval list via defaults
    // 2. Terminate any app if it's running
    // 3. Open the deeplink

    // Add the deeplink to the scheme approval list:
    const schema = new URL(expoDeeplink).protocol.slice(0, -1);
    await this.simCtl.spawn(
      "defaults",
      "write",
      "com.apple.launchservices.schemeapproval",
      `com.apple.CoreSimulator.CoreSimulatorBridge-->${schema}`,
      "-string",
      bundleID
    );

    await this.terminateAnyRunningApplications();

    // Use openurl to open the deeplink:
    await this.simCtl.openUrl(
      expoDeeplink
      // TODO: disableOnboarding param causes error while launching
      // + "&disableOnboarding=1", // disable onboarding dialog via deeplink query param
    );
  }

  async launchApp(
    build: IOSBuildResult,
    metroPort: number,
    _devtoolsPort: number,
    launchArguments: string[]
  ) {
    if (build.platform !== DevicePlatform.IOS) {
      throw new Error("Invalid platform");
    }
    const deepLinkChoice = build.bundleID === EXPO_GO_BUNDLE_ID ? "expo-go" : "expo-dev-client";
    const expoDeeplink = await fetchExpoLaunchDeeplink(metroPort, "ios", deepLinkChoice);
    if (expoDeeplink) {
      this.launchWithExpoDeeplink(build.bundleID, expoDeeplink);
    } else {
      await this.configureMetroPort(build.bundleID, metroPort);
      await this.launchWithBuild(build, launchArguments);
    }
  }

  async installApp(build: BuildResult, forceReinstall: boolean) {
    if (build.platform !== DevicePlatform.IOS) {
      throw new Error("Invalid platform");
    }
    if (forceReinstall) {
      try {
        await this.simCtl.uninstallApp(build.bundleID);
      } catch (e) {
        // NOTE: Error while uninstalling will be ignored
      }
    }
    await this.simCtl.installApp(build.appPath);
  }

  async resetAppPermissions(appPermission: AppPermissionType, build: BuildResult) {
    if (build.platform !== DevicePlatform.IOS) {
      throw new Error("Invalid platform");
    }
    await this.simCtl.resetPrivacyService(appPermission, build.bundleID);
    return false;
  }

  async sendDeepLink(link: string, build: BuildResult) {
    if (build.platform !== DevicePlatform.IOS) {
      throw new Error("Invalid platform");
    }

    await this.simCtl.openUrl(link);
  }

  makePreview(): Preview {
    return new Preview([
      "ios",
      "--id",
      this.deviceUDID,
      "--device-set",
      this.simCtl.deviceSetLocation,
    ]);
  }

  public async sendFile(filePath: string): Promise<void> {
    if (!isMediaFile(filePath)) {
      throw new Error("Only media file transfer is supported on iOS.");
    }
    await this.simCtl.addMedia(filePath);
  }
}

function isMediaFile(filePath: string): boolean {
  const type = mime.lookup(filePath);
  return type.startsWith("image/") || type.startsWith("video/");
}

export async function renameIosSimulator(udid: string, newDisplayName: string) {
  await new SimCtl(udid, getOrCreateDeviceSet(udid)).renameSimulator(newDisplayName);
}

export async function removeIosSimulator(udid: string) {
  await SimCtl.deleteSimulator(udid, getOrCreateDeviceSet(udid));
}

async function listSimulatorsForLocation(location?: string) {
  try {
    const simulatorData = await SimCtl.listSimulatorsForLocation(location);
    const { devices: devicesPerRuntime } = simulatorData;

    return Object.entries(devicesPerRuntime);
  } catch (e) {
    // ignore errors because some locations might not exist
    return [];
  }
}

export async function listSimulators(): Promise<IOSDeviceInfo[]> {
  let devicesPerRuntime;
  const deviceSetLocation = getOrCreateDeviceSet();

  devicesPerRuntime = await listSimulatorsForLocation(deviceSetLocation);

  const oldDeviceSetLocation = getOldDeviceSetLocation();
  const oldDevicesPerRuntime = await listSimulatorsForLocation(oldDeviceSetLocation);

  devicesPerRuntime = devicesPerRuntime.concat(oldDevicesPerRuntime);

  const runtimes = await getAvailableIosRuntimes();

  const simulators = devicesPerRuntime
    .map(([runtimeID, devices]) => {
      const runtime = runtimes.find((item) => item.identifier === runtimeID);

      return devices.map((device) => {
        return {
          id: `ios-${device.udid}`,
          platform: DevicePlatform.IOS as const,
          UDID: device.udid,
          modelId: device.deviceTypeIdentifier,
          systemName: runtime?.name ?? "Unknown",
          displayName: device.name,
          deviceType: device.deviceTypeIdentifier.includes("iPad")
            ? DeviceType.Tablet
            : DeviceType.Phone,
          available: device.isAvailable ?? false,
          runtimeInfo: runtime!,
        };
      });
    })
    .flat();
  return simulators;
}

export async function createSimulator(
  modelId: string,
  displayName: string,
  runtime: IOSRuntimeInfo
) {
  Logger.debug(`Create simulator ${modelId} with runtime ${runtime.identifier}`);

  // create new simulator with selected runtime
  const UDID = await SimCtl.createSimulator(
    getOrCreateDeviceSet(),
    displayName,
    modelId,
    runtime.identifier
  );

  return {
    id: `ios-${UDID}`,
    platform: DevicePlatform.IOS,
    UDID,
    modelId: modelId,
    systemName: runtime.name,
    displayName: displayName,
    available: true, // assuming if create command went through, it's available
    runtimeInfo: runtime,
  } as IOSDeviceInfo;
}

function getDeviceSetLocation(deviceUDID?: string) {
  const appCachesDir = getAppCachesDir();
  const deviceSetLocation = path.join(appCachesDir, "Devices", "iOS");
  if (!deviceUDID) {
    return deviceSetLocation;
  }
  const oldDeviceSetLocation = getOldDeviceSetLocation();
  if (!fs.existsSync(oldDeviceSetLocation)) {
    return deviceSetLocation;
  }
  const devices = fs.readdirSync(oldDeviceSetLocation);
  if (devices.includes(deviceUDID)) {
    return oldDeviceSetLocation;
  }
  return deviceSetLocation;
}

function getOldDeviceSetLocation() {
  const oldAppCachesDir = getOldAppCachesDir();
  return path.join(oldAppCachesDir, "Devices", "iOS");
}

function getOrCreateDeviceSet(deviceUDID?: string) {
  let deviceSetLocation = getDeviceSetLocation(deviceUDID);
  if (!fs.existsSync(deviceSetLocation)) {
    fs.mkdirSync(deviceSetLocation, { recursive: true });
  }

  return deviceSetLocation;
}
