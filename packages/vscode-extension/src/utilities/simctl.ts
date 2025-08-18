import { exec } from "./subprocess";
import { DeviceSettings } from "../common/Project";

export type PrivacyServiceName =
  | "all"
  | "calendar"
  | "contacts-limited"
  | "contacts"
  | "location"
  | "location-always"
  | "photos-add"
  | "photos"
  | "media-library"
  | "microphone"
  | "motion"
  | "reminders"
  | "siri";

type ExecOptions = Parameters<typeof exec>[2];

export type RuntimeInfo = {
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
};
export interface SimulatorInfo {
  availability?: string;
  state?: string;
  isAvailable?: boolean;
  name: string;
  udid: string;
  version?: string;
  displayName: string;
  availabilityError?: string;
  type?: "simulator" | "device" | "catalyst";
  booted?: boolean;
  lastBootedAt?: string;
  deviceTypeIdentifier: string;
}

export interface SimulatorData {
  devices: { [runtimeID: string]: SimulatorInfo[] };
}

export class SimCtl {
  public static async listRuntimes(): Promise<RuntimeInfo[]> {
    return JSON.parse((await exec("xcrun", ["simctl", "list", "runtimes", "--json"])).stdout)
      .runtimes;
  }
  public static async createSimulator(
    deviceSetLocation: string,
    displayName: string,
    modelId: string,
    runtimeId: string
  ) {
    const { stdout: udid } = await exec("xcrun", [
      "simctl",
      "--set",
      deviceSetLocation,
      "create",
      displayName,
      modelId,
      runtimeId,
    ]);
    return udid;
  }

  public static async deleteSimulator(udid: string, deviceSetLocation: string) {
    await new SimCtl(udid, deviceSetLocation).runCommand("delete");
  }

  public static async listSimulatorsForLocation(location?: string) {
    let deviceSetArgs: string[] = [];
    if (location) {
      deviceSetArgs = ["--set", location];
    }
    const { stdout } = await exec(
      "xcrun",
      ["simctl", ...deviceSetArgs, "list", "devices", "--json"],
      { allowNonZeroExit: true }
    );
    return JSON.parse(stdout) as SimulatorData;
  }

  constructor(
    private readonly deviceUDID: string,
    public readonly deviceSetLocation: string
  ) {}

  private async runCommand(command: string, args: string[] = [], options?: ExecOptions) {
    return await exec(
      "xcrun",
      ["simctl", "--set", this.deviceSetLocation, command, this.deviceUDID, ...args],
      options
    );
  }

  public async boot() {
    await this.runCommand("boot", [], { allowNonZeroExit: true });
  }

  public async shutdown() {
    await this.runCommand("shutdown", [], { allowNonZeroExit: true });
  }

  public async renameSimulator(newName: string) {
    await this.runCommand("rename", [newName]);
  }

  public async installApp(appPath: string) {
    await this.runCommand("install", [appPath]);
  }

  public async uninstallApp(bundleID: string) {
    await this.runCommand("uninstall", [bundleID], { allowNonZeroExit: true });
  }

  public launchApp(bundleID: string, launchArgs: string[]) {
    const xcrunArgs = [
      "simctl",
      "--set",
      this.deviceSetLocation,
      "launch",
      "--console",
      "--terminate-running-process",
      this.deviceUDID,
      bundleID,
      ...launchArgs,
    ];

    const process = exec("xcrun", xcrunArgs);
    return process;
  }

  public async terminateApp(bundleID: string) {
    await this.runCommand("terminate", [bundleID], { allowNonZeroExit: true });
  }

  public async listApps(): Promise<string> {
    const { stdout } = await this.runCommand("listapps");
    return stdout;
  }

  public async getAppContainer(bundleID: string, container: "app" | "data" | "groups" | string) {
    const { stdout } = await this.runCommand("get_app_container", [bundleID, container]);
    return stdout;
  }

  public async setAppearance(appearance: "light" | "dark") {
    await this.runCommand("ui", ["appearance", appearance]);
  }

  public async setContentSize(size: DeviceSettings["contentSize"]) {
    await this.runCommand("ui", ["content_size", convertToSimctlSize(size)]);
  }

  public async setLocation(location: DeviceSettings["location"]) {
    if (location.isDisabled) {
      await this.runCommand("location", ["clear"]);
    }
    await this.runCommand("location", [
      "set",
      `${location.latitude.toString()},${location.longitude.toString()}`,
    ]);
  }

  public async sendBiometricAuthorization(isMatch: boolean) {
    await this.runCommand("spawn", [
      "notifyutil",
      "-p",
      isMatch
        ? "com.apple.BiometricKit_Sim.fingerTouch.match"
        : "com.apple.BiometricKit_Sim.fingerTouch.nomatch",
    ]);
  }

  public async notifyBiometricEnrollmentChanged(hasEnrolledBiometrics: boolean) {
    await this.runCommand("spawn", [
      "notifyutil",
      "-s",
      "com.apple.BiometricKit.enrollmentChanged",
      hasEnrolledBiometrics ? "1" : "0",
    ]);
    await this.runCommand("spawn", [
      "notifyutil",
      "-p",
      "com.apple.BiometricKit.enrollmentChanged",
    ]);
  }

  public async clipboardCopy(text: string) {
    await this.runCommand("pbcopy", [], { input: text });
  }

  public async clipboardPaste() {
    const { stdout } = await this.runCommand("pbpaste");
    return stdout;
  }

  public async openUrl(url: string) {
    await this.runCommand("openurl", [url]);
  }

  public async addMedia(filePath: string) {
    await this.runCommand("addmedia", [filePath]);
  }

  public async resetPrivacyService(privacyServiceName: PrivacyServiceName, bundleID: string) {
    await this.runCommand("privacy", ["reset", privacyServiceName, bundleID]);
  }

  public async spawn(command: string, ...args: string[]) {
    await this.runCommand("spawn", [command, ...args]);
  }
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
