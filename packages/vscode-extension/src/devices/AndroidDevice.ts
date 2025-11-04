import path from "path";
import xml2js from "xml2js";
import * as vscode from "vscode";
import { Disposable } from "vscode";
import { exec, lineReader } from "../utilities/subprocess";
import {
  DevicePlatform,
  DeviceSettings,
  InstallationError,
  InstallationErrorReason,
} from "../common/State";
import { DeviceBase } from "./DeviceBase";
import { BuildResult } from "../builders/BuildManager";
import { AppPermissionType } from "../common/Project";
import { Logger } from "../Logger";
import { retry } from "../utilities/retry";
import { ANDROID_HOME } from "../utilities/android";
import { Platform } from "../utilities/platform";
import { AndroidBuildResult } from "../builders/buildAndroid";
import { EXPO_GO_PACKAGE_NAME, fetchExpoLaunchDeeplink } from "../builders/expoGo";
import { Output } from "../common/OutputChannel";
import { OutputChannelRegistry } from "../project/OutputChannelRegistry";

export const ADB_PATH = path.join(
  ANDROID_HOME,
  "platform-tools",
  Platform.select({
    macos: "adb",
    windows: "adb.exe",
    linux: "adb",
  })
);

export abstract class AndroidDevice extends DeviceBase implements Disposable {
  protected serial: string | undefined;

  constructor(
    deviceSettings: DeviceSettings,
    protected readonly outputChannelRegistry: OutputChannelRegistry
  ) {
    super(deviceSettings);
  }

  protected get nativeLogsOutputChannel() {
    return this.outputChannelRegistry.getOrCreateOutputChannel(Output.AndroidDevice);
  }
  private get maestroLogsOutputChannel() {
    return this.outputChannelRegistry.getOrCreateOutputChannel(Output.MaestroAndroid);
  }

  public get platform(): DevicePlatform {
    return DevicePlatform.Android;
  }

  public async installApp(build: BuildResult, forceReinstall: boolean) {
    if (build.platform !== DevicePlatform.Android) {
      throw new InstallationError("Invalid platform", InstallationErrorReason.InvalidPlatform);
    }

    // allowNonZeroExit is set to true to not print errors when INSTALL_FAILED_UPDATE_INCOMPATIBLE occurs.
    const installApk = (allowDowngrade: boolean) =>
      exec(
        ADB_PATH,
        ["-s", this.serial!, "install", ...(allowDowngrade ? ["-d"] : []), "-r", build.apkPath],
        { allowNonZeroExit: true }
      );

    const uninstallApp = async (packageName: string) => {
      try {
        await retry(
          () =>
            exec(ADB_PATH, ["-s", this.serial!, "uninstall", packageName], {
              allowNonZeroExit: true,
            }),
          2,
          1000
        );
      } catch (e) {
        Logger.error("Error while uninstalling will be ignored", e);
      }
    };

    // adb install sometimes fails because we call it too early after the device is initialized.
    // we haven't found a better way to test if device is ready and already wait for boot_completed
    // flag in waitForEmulatorOnline. But even after that even is delivered, adb install also sometimes
    // fails claiming it is too early. The workaround therefore is to retry install command.
    if (forceReinstall) {
      await uninstallApp(build.packageName);
    }
    try {
      await retry(
        async (retryNumber) => {
          if (retryNumber === 0) {
            await installApk(false);
          } else if (retryNumber === 1) {
            // There's a chance that same emulator was used in newer version of Expo
            // and then RN IDE was opened on older project, in which case installation
            // will fail. We use -d flag which allows for downgrading debuggable
            // applications (see `adb shell pm`, install command)
            await installApk(true);
          } else {
            // If the app is still not installed, we try to uninstall it first to
            // avoid "INSTALL_FAILED_UPDATE_INCOMPATIBLE: Existing package <name>
            // signatures do not match newer version; ignoring!" error. This error
            // may come when building locally and with EAS.
            await uninstallApp(build.packageName);
            await installApk(true);
          }
        },
        2,
        1000
      );
    } catch (e) {
      const message =
        typeof e === "object" && e !== null && "message" in e
          ? String((e as any).message)
          : String(e);
      if (
        message.includes("INSTALL_FAILED_INSUFFICIENT_STORAGE") ||
        message.includes("not enough space")
      ) {
        throw new InstallationError(
          "Not enough space on device, consider switching device.",
          InstallationErrorReason.NotEnoughStorage
        );
      }
      throw new InstallationError(message, InstallationErrorReason.Unknown);
    }
  }

  public async launchApp(build: BuildResult, metroPort: number, devtoolsPort?: number) {
    if (build.platform !== DevicePlatform.Android) {
      throw new Error("Invalid platform");
    }
    // terminate the app before launching, otherwise launch commands won't actually start the process which
    // may be in a bad state
    await this.terminateApp(build.packageName);

    this.mirrorNativeLogs(build);

    const deepLinkChoice =
      build.packageName === EXPO_GO_PACKAGE_NAME ? "expo-go" : "expo-dev-client";
    const expoDeeplink = await fetchExpoLaunchDeeplink(metroPort, "android", deepLinkChoice);
    if (expoDeeplink) {
      await this.configureExpoDevMenu(build.packageName);
      await this.launchWithExpoDeeplink(metroPort, devtoolsPort, expoDeeplink);
    } else {
      await this.configureMetroPort(build.packageName, metroPort);
      await this.launchWithBuild(build);
    }
  }

  public async terminateApp(packageName: string) {
    await exec(ADB_PATH, ["-s", this.serial!, "shell", "am", "force-stop", packageName]);
  }

  public async sendDeepLink(link: string, build: BuildResult) {
    if (build.platform !== DevicePlatform.Android) {
      throw new Error("Invalid platform");
    }

    await exec(ADB_PATH, [
      "-s",
      this.serial!,
      "shell",
      "am",
      "start",
      "-W",
      "-a",
      "android.intent.action.VIEW",
      "-d",
      link,
      build.packageName,
    ]);
  }

  public setUpKeyboard() {
    // Keyboard setup is not required on Android devices.
  }

  public async sendBiometricAuthorization(_isMatch: boolean) {
    // TODO: implement android biometric authorization
  }

  public async resetAppPermissions(appPermission: AppPermissionType, build: BuildResult) {
    if (build.platform !== DevicePlatform.Android) {
      throw new Error("Invalid platform");
    }
    if (appPermission !== "all") {
      Logger.warn(
        "Resetting all privacy permission as individual permissions aren't currently supported on Android."
      );
    }
    await exec(ADB_PATH, [
      "-s",
      this.serial!,
      "shell",
      "pm",
      "reset-permissions",
      build.packageName,
    ]);
    return true; // Android will terminate the process if any of the permissions were granted prior to reset-permissions call
  }

  public async sendFile(filePath: string) {
    const args = ["push", "-q", filePath, `/sdcard/Download/${path.basename(filePath)}`];
    await exec(ADB_PATH, ["-s", this.serial!, ...args]);
    // Notify the media scanner about the new file
    await exec(ADB_PATH, [
      "-s",
      this.serial!,
      "shell",
      "am",
      "broadcast",
      "-a",
      "android.intent.action.MEDIA_SCANNER_SCAN_FILE",
      "--receiver-include-background",
      "-d",
      `file:///sdcard/Download`,
    ]);
    return { canSafelyRemove: true };
  }
  
  protected async runMaestroTest(fileName: string) {
    const document = await vscode.workspace.openTextDocument(fileName);
    if (document.isDirty) {
      await document.save();
    }
    
    this.maestroLogsOutputChannel.show(true);
    this.maestroLogsOutputChannel.appendLine("");
    this.maestroLogsOutputChannel.appendLine(`Starting a Maestro flow from ${fileName} on ${this.deviceInfo.displayName}`);

    const maestroProcess = exec(
      "maestro",
      ["--device", this.serial || "device", "test", fileName],
      { buffer: false, stdin: "ignore" }
    );
    this.maestroProcess = maestroProcess;

    lineReader(maestroProcess).onLineRead(this.maestroLogsOutputChannel.appendLine);

    const resultOrError = await maestroProcess.catch((e) => e);
    const exitCode = resultOrError.exitCode ?? 1;

    this.maestroProcess = undefined;
    if (exitCode !== 0) {
      this.maestroLogsOutputChannel.appendLine(`Maestro test failed with exit code ${exitCode}`);
    } else {
      this.maestroLogsOutputChannel.appendLine("Maestro test completed successfully!");
    }
  }

  protected async abortMaestroTest(): Promise<void> {
    if (!this.maestroProcess) {
      return;
    }

    this.maestroLogsOutputChannel.appendLine("Aborting Maestro test...");

    const proc = this.maestroProcess;
    try {
      proc.kill();
    } catch (e) {}

    const killer = setTimeout(() => {
      try {
        proc.kill(9);
      } catch (e) {}
    }, 3000);

    try {
      await proc;
    } catch (_e) {}

    clearTimeout(killer);
    this.maestroProcess = undefined;
    this.maestroLogsOutputChannel.appendLine("Maestro test aborted");
  }

  private async configureExpoDevMenu(packageName: string) {
    if (packageName === "host.exp.exponent") {
      // For expo go we are unable to change this setting as the APK is not debuggable
      return;
    }
    // this code disables expo devmenu popup when the app is launched. When dev menu
    // is displayed, it blocks the JS loop and hence react devtools are unable to establish
    // the connection, and hence we never get the app ready event.
    const prefsXML = `<?xml version='1.0' encoding='utf-8' standalone='yes' ?>\n<map><boolean name="isOnboardingFinished" value="true"/></map>`;
    await exec(
      ADB_PATH,
      [
        "-s",
        this.serial!,
        "shell",
        `run-as ${packageName} sh -c 'mkdir -p /data/data/${packageName}/shared_prefs && cat > /data/data/${packageName}/shared_prefs/expo.modules.devmenu.sharedpreferences.xml'`,
      ],
      {
        // pass serialized prefs as input:
        input: prefsXML,
      }
    );
  }

  private async configureMetroPort(packageName: string, metroPort: number) {
    // read preferences
    await exec(ADB_PATH, ["-s", this.serial!, "reverse", `tcp:${metroPort}`, `tcp:${metroPort}`]);
    let prefs: { map: any };
    try {
      const { stdout } = await exec(
        ADB_PATH,
        [
          "-s",
          this.serial!,
          "shell",
          "run-as",
          packageName,
          "cat",
          `/data/data/${packageName}/shared_prefs/${packageName}_preferences.xml`,
        ],
        { allowNonZeroExit: true }
      );
      prefs = await xml2js.parseStringPromise(stdout, { explicitArray: true });
      // test if prefs.map is an object, otherwise we just start from an empty prefs
      if (typeof prefs.map !== "object") {
        throw new Error("Invalid prefs file format");
      }
    } catch (e) {
      // preferences file does not exists
      prefs = { map: {} };
    }

    // filter out existing debug_http_host record
    prefs.map.string = prefs.map.string?.filter((s: any) => s.$.name !== "debug_http_host") || [];
    // add new debug_http_host record pointing to 10.0.2.2:metroPort (localhost from emulator)
    prefs.map.string.push({ $: { name: "debug_http_host" }, _: `localhost:${metroPort}` });
    const prefsXML = new xml2js.Builder().buildObject(prefs);

    // write prefs
    await exec(
      ADB_PATH,
      [
        "-s",
        this.serial!,
        "shell",
        `run-as ${packageName} sh -c 'mkdir -p /data/data/${packageName}/shared_prefs && cat > /data/data/${packageName}/shared_prefs/${packageName}_preferences.xml'`,
      ],
      {
        // pass serialized prefs as input:
        input: prefsXML,
      }
    );
  }

  private async launchWithBuild(build: AndroidBuildResult) {
    await exec(ADB_PATH, [
      "-s",
      this.serial!,
      "shell",
      "monkey",
      "-p",
      build.packageName,
      "-c",
      "android.intent.category.LAUNCHER",
      "1",
    ]);
  }

  private async launchWithExpoDeeplink(
    metroPort: number,
    devtoolsPort: number | undefined,
    expoDeeplink: string
  ) {
    // For Expo dev-client and expo go setup, we use deeplink to launch the app. Since Expo's manifest is configured to
    // return localhost:PORT as the destination, we need to setup adb reverse for metro port first.
    await exec(ADB_PATH, ["-s", this.serial!, "reverse", `tcp:${metroPort}`, `tcp:${metroPort}`]);
    if (devtoolsPort !== undefined) {
      await exec(ADB_PATH, [
        "-s",
        this.serial!,
        "reverse",
        `tcp:${devtoolsPort}`,
        `tcp:${devtoolsPort}`,
      ]);
    }
    // next, we open the link
    await exec(ADB_PATH, [
      "-s",
      this.serial!,
      "shell",
      "am",
      "start",
      "-a",
      "android.intent.action.VIEW",
      "-d",
      expoDeeplink,
    ]);
  }

  protected abstract mirrorNativeLogs(build: AndroidBuildResult): void;

  public dispose() {
    super.dispose();
  }
}
