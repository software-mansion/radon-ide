import path from "path";
import fs from "fs";
import { EOL } from "node:os";
import { OutputChannel, window } from "vscode";
import xml2js from "xml2js";
import { v4 as uuidv4 } from "uuid";
import { Preview } from "./preview";
import { DeviceBase } from "./DeviceBase";
import { retry } from "../utilities/retry";
import { getAppCachesDir, getNativeABI, getOldAppCachesDir } from "../utilities/common";
import { ANDROID_HOME } from "../utilities/android";
import { ChildProcess, exec, lineReader } from "../utilities/subprocess";
import { BuildResult } from "../builders/BuildManager";
import { AndroidSystemImageInfo, DeviceInfo, DevicePlatform } from "../common/DeviceManager";
import { Logger } from "../Logger";
import { AppPermissionType, DeviceSettings, Locale } from "../common/Project";
import { getAndroidSystemImages } from "../utilities/sdkmanager";
import { EXPO_GO_PACKAGE_NAME, fetchExpoLaunchDeeplink } from "../builders/expoGo";
import { Platform } from "../utilities/platform";
import { AndroidBuildResult } from "../builders/buildAndroid";
import { CancelToken } from "../builders/cancelToken";

export const EMULATOR_BINARY = path.join(
  ANDROID_HOME,
  "emulator",
  Platform.select({
    macos: "emulator",
    windows: "emulator.exe",
    linux: "emulator",
  })
);
const ADB_PATH = path.join(
  ANDROID_HOME,
  "platform-tools",
  Platform.select({
    macos: "adb",
    windows: "adb.exe",
    linux: "adb",
  })
);

const REBOOT_TIMEOUT = 3000;
const DISPOSE_TIMEOUT = 9000;

interface EmulatorProcessInfo {
  pid: number;
  serialPort: number;
  adbPort: number;
  avdName: string;
  avdDir: string;
  grpcPort: number;
  grpcToken: string;
}

export class AndroidEmulatorDevice extends DeviceBase {
  private emulatorProcess: ChildProcess | undefined;
  private serial: string | undefined;
  private nativeLogsOutputChannel: OutputChannel | undefined;
  private nativeLogsCancelToken: CancelToken | undefined;

  constructor(private readonly avdId: string, private readonly info: DeviceInfo) {
    super();
  }

  public get platform(): DevicePlatform {
    return DevicePlatform.Android;
  }

  get deviceInfo(): DeviceInfo {
    return this.info;
  }

  get lockFilePath(): string {
    const avdDirectory = getAvdDirectoryLocation(this.avdId);
    const pidFile = path.join(avdDirectory, `${this.avdId}.avd`, "lock.pid");
    return pidFile;
  }

  public dispose(): void {
    super.dispose();
    this.emulatorProcess?.kill();
    this.nativeLogsOutputChannel?.dispose();
    this.nativeLogsCancelToken?.cancel();
    // If the emulator process does not shut down initially due to ongoing activities or processes,
    // a forced termination (kill signal) is sent after a certain timeout period.
    setTimeout(() => {
      this.emulatorProcess?.kill(9);
    }, DISPOSE_TIMEOUT);
  }

  private async shouldUpdateLocale(newLocale: Locale) {
    const locale = newLocale.replace("_", "-");
    const { stdout } = await exec(ADB_PATH, [
      "-s",
      this.serial!,
      "shell",
      "settings",
      "get",
      "system",
      "system_locales",
    ]);

    // if user did not use the device before it might not have system_locales property
    // as en-US is the default locale, used by the system, when no setting is provided
    // we assume that no value in stdout is the same as en-US
    if ((stdout ?? "en-US") === locale) {
      return false;
    }
    return true;
  }

  /**
   * This method changes device locale by modifying system_locales system setting.
   */
  private async changeLocale(newLocale: Locale): Promise<void> {
    const locale = newLocale.replace("_", "-");

    await exec(ADB_PATH, [
      "-s",
      this.serial!,
      "shell",
      "settings",
      "put",
      "system",
      "system_locales",
      locale,
    ]);

    // this is needed to make sure that changes will persist
    await exec(ADB_PATH, ["-s", this.serial!, "shell", "sync"]);

    // TODO:  Find a way to change or remove persist.sys.locale without root access. note: removing the whole
    // data/property/persistent_properties file would also work as we persist device settings globally in Radon IDE
    const { stdout } = await exec(ADB_PATH, [
      "-s",
      this.serial!,
      "shell",
      "getprop",
      "persist.sys.locale",
    ]);

    if (stdout) {
      Logger.warn(
        "Updating locale will not take effect as the device has altered locale via system settings which always takes precedence over the device setting the IDE uses."
      );
    }
  }

  async changeSettings(settings: DeviceSettings) {
    let shouldRestart = false;
    if (await this.shouldUpdateLocale(settings.locale)) {
      shouldRestart = true;
      await this.changeLocale(settings.locale);
    }

    await exec(ADB_PATH, [
      "-s",
      this.serial!,
      "shell",
      "settings",
      "put",
      "system",
      "font_scale",
      convertToAdbFontSize(settings.contentSize).toString(),
      "&&",
      `cmd uimode night ${settings.appearance === "light" ? "no" : "yes"}`,
    ]);
    // location_mode: LOCATION_MODE_OFF: 0 LOCATION_MODE_HIGH_ACCURACY: 3 LOCATION_MODE_BATTERY_SAVING: 2 LOCATION_MODE_SENSORS_ONLY: 1
    if (settings.location.isDisabled) {
      await exec(ADB_PATH, [
        "-s",
        this.serial!,
        "shell",
        "settings",
        "put",
        "secure",
        "location_mode",
        "0",
      ]);
    } else {
      await exec(ADB_PATH, [
        "-s",
        this.serial!,
        "shell",
        "settings",
        "put",
        "secure",
        "location_mode",
        "3",
      ]);

      // This is a work around for the problem with emu geo command not working  when passed, 0 0 coordinates
      // when provided coordinates are close enough to 0 that the adb assumes they are 0 we pass the smallest
      // working number instead. Moreover note that geo fix command takes arguments:
      // $longitude , $latitude so the order is reversed compared to most conventions
      const areCoordinatesToCloseToZero =
        Math.abs(settings.location.latitude) < 0.00001 &&
        Math.abs(settings.location.longitude) < 0.00001;
      const lat = areCoordinatesToCloseToZero ? "0.00001" : settings.location.latitude.toString();
      const long = areCoordinatesToCloseToZero ? "0.00001" : settings.location.longitude.toString();
      await exec(ADB_PATH, ["-s", this.serial!, "emu", "geo", "fix", long, lat]);
    }
    return shouldRestart;
  }

  /**
   * This method restarts the emulator process using SIGKILL signal.
   * Should be used for the situations when quick reboot is necessary
   * and when we don't care about the emulator's process state
   */
  private async forcefullyResetDevice() {
    this.emulatorProcess?.kill(9);
    await this.internalBootDevice();
  }

  public async reboot(){
    const {promise, resolve} = Promise.withResolvers<void>()  

    const timeout = setTimeout(async () => {
      this.emulatorProcess?.off("exit", exitListener);
      await this.forcefullyResetDevice();
      resolve();
    }, REBOOT_TIMEOUT)

    const exitListener = async () => {
      await this.internalBootDevice();
      clearTimeout(timeout);
      resolve();
    }

    this.emulatorProcess?.on("exit", exitListener);
    this.emulatorProcess?.kill();

    return promise;
  }

  async bootDevice(deviceSettings: DeviceSettings): Promise<void> {
    await this.internalBootDevice();

    let shouldRestart = await this.changeSettings(deviceSettings);
    if (shouldRestart) {
      await this.forcefullyResetDevice();
    }
  }

  async internalBootDevice() {
    // this prevents booting device with the same AVD twice
    await ensureOldEmulatorProcessExited(this.avdId);

    const avdDirectory = getOrCreateAvdDirectory(this.avdId);

    const subprocess = exec(
      EMULATOR_BINARY,
      [
        "-avd",
        this.avdId,
        "-qt-hide-window",
        "-no-audio",
        "-no-boot-anim",
        "-grpc-use-token",
        "-no-snapshot-save",
        "-writable-system",
      ],
      { env: { ANDROID_AVD_HOME: avdDirectory } }
    );
    this.emulatorProcess = subprocess;

    const initPromise = new Promise<string>((resolve, reject) => {
      subprocess.catch(reject).then(() => {
        // we expect the process to produce an expected output that we listed for
        // below and resolve the promise earlier. However, if the process exists
        // and the promise is still not resolved we should reject it such that we
        // don't hold other code waiting for it indefinitely.
        reject(new Error("Emulator process exited without producing expected output"));
      });

      lineReader(subprocess).onLineRead(async (line) => {
        Logger.debug("Emulator output", line);
        if (line.includes("Advertising in:")) {
          const match = line.match(/Advertising in: (\S+)/);
          const iniFile = match![1];
          const emulatorInfo = await parseAvdIniFile(iniFile);
          const emulatorSerial = `emulator-${emulatorInfo.serialPort}`;
          await waitForEmulatorOnline(emulatorSerial, 60000);
          resolve(emulatorSerial);
        }
      });
    });

    this.serial = await initPromise;
  }

  async configureExpoDevMenu(packageName: string) {
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

  async configureMetroPort(packageName: string, metroPort: number) {
    // read preferences
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
    prefs.map.string.push({ $: { name: "debug_http_host" }, _: `10.0.2.2:${metroPort}` });
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

  async launchWithBuild(build: AndroidBuildResult) {
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

  async launchWithExpoDeeplink(metroPort: number, devtoolsPort: number, expoDeeplink: string) {
    // For Expo dev-client and expo go setup, we use deeplink to launch the app. Since Expo's manifest is configured to
    // return localhost:PORT as the destination, we need to setup adb reverse for metro port first.
    await exec(ADB_PATH, ["-s", this.serial!, "reverse", `tcp:${metroPort}`, `tcp:${metroPort}`]);
    await exec(ADB_PATH, [
      "-s",
      this.serial!,
      "reverse",
      `tcp:${devtoolsPort}`,
      `tcp:${devtoolsPort}`,
    ]);
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

  async mirrorNativeLogs(build: AndroidBuildResult) {
    if (this.nativeLogsCancelToken) {
      this.nativeLogsCancelToken.cancel();
    }

    this.nativeLogsCancelToken = new CancelToken();

    const extractPidFromLogcat = async (cancelToken: CancelToken) =>
      new Promise<string>((resolve, reject) => {
        const regexString = `Start proc ([0-9]{4}):${build.packageName}`;
        const process = exec(ADB_PATH, [
          "-s",
          this.serial!,
          "logcat",
          "-e",
          regexString,
          "-T",
          "1",
        ]);
        cancelToken.adapt(process);

        lineReader(process).onLineRead((line) => {
          const regex = new RegExp(regexString);

          if (regex.test(line)) {
            const groups = regex.exec(line);
            const pid = groups?.[1];
            process.kill();

            if (pid) {
              resolve(pid);
            } else {
              reject(new Error("PID not found"));
            }
          }
        });

        // We should be able to get pid immediately, if we're not getting it in 10s, then we reject to not run this process indefinitely.
        setTimeout(() => {
          process.kill();
          reject(new Error("Timeout while waiting for app to start to get the process PID."));
        }, 10000);
      });

    if (!this.nativeLogsOutputChannel) {
      this.nativeLogsOutputChannel = window.createOutputChannel(
        "Radon IDE (Android Emulator Logs)",
        "log"
      );
    }

    this.nativeLogsOutputChannel.clear();
    const pid = await extractPidFromLogcat(this.nativeLogsCancelToken);
    const process = exec(ADB_PATH, ["-s", this.serial!, "logcat", "--pid", pid]);
    this.nativeLogsCancelToken.adapt(process);

    lineReader(process).onLineRead(this.nativeLogsOutputChannel.appendLine);
  }

  async launchApp(build: BuildResult, metroPort: number, devtoolsPort: number) {
    if (build.platform !== DevicePlatform.Android) {
      throw new Error("Invalid platform");
    }
    // terminate the app before launching, otherwise launch commands won't actually start the process which
    // may be in a bad state
    this.terminateApp(build.packageName);

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

  async installApp(build: BuildResult, forceReinstall: boolean) {
    if (build.platform !== DevicePlatform.Android) {
      throw new Error("Invalid platform");
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
  }

  async resetAppPermissions(appPermission: AppPermissionType, build: BuildResult) {
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

  async terminateApp(packageName: string) {
    await exec(ADB_PATH, ["-s", this.serial!, "shell", "am", "force-stop", packageName]);
  }

  async sendDeepLink(link: string, build: BuildResult) {
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

  makePreview(): Preview {
    return new Preview(["android", "--id", this.serial!]);
  }

  async sendBiometricAuthorization(isMatch: boolean) {
    // TODO: implement android biometric authorization
  }

  async getClipboard() {
    // No need to copy clipboard, Android Emulator syncs it for us whenever a user clicks on 'Copy'
  }
}

export async function createEmulator(
  modelId: string,
  displayName: string,
  systemImage: AndroidSystemImageInfo
) {
  const avdDirectory = getOrCreateAvdDirectory();
  const avdId = uuidv4();
  const avdIni = path.join(avdDirectory, `${avdId}.ini`);
  const avdLocation = path.join(avdDirectory, `${avdId}.avd`);
  const configIni = path.join(avdLocation, "config.ini");

  fs.mkdirSync(avdLocation, { recursive: true });

  const avdIniData = [
    ["avd.ini.encoding", "UTF-8"],
    ["path", avdLocation],
  ];
  const avdIniContent = avdIniData.map(([key, value]) => `${key}=${value}`).join("\n");
  await fs.promises.writeFile(avdIni, avdIniContent, "utf-8");

  const configIniData = [
    ["AvdId", avdId],
    ["PlayStore.enabled", "true"],
    ["abi.type", getNativeABI()],
    ["avd.ini.displayname", displayName],
    ["avd.ini.encoding", "UTF-8"],
    ["disk.dataPartition.size", "6442450944"],
    ["fastboot.chosenSnapshotFile", ""],
    ["fastboot.forceChosenSnapshotBoot", "no"],
    ["fastboot.forceColdBoot", "no"],
    ["fastboot.forceFastBoot", "yes"],
    ["hw.accelerometer", "yes"],
    ["hw.arc", "false"],
    ["hw.audioInput", "yes"],
    ["hw.battery", "yes"],
    ["hw.camera.back", "virtualscene"],
    ["hw.camera.front", "emulated"],
    ["hw.cpu.arch", getNativeQemuArch()],
    ["hw.cpu.ncore", "4"],
    ["hw.dPad", "no"],
    ["hw.device.manufacturer", "Google"],
    ["hw.device.name", modelId],
    ["hw.gps", "yes"],
    ["hw.gpu.enabled", "yes"],
    ["hw.gpu.mode", "auto"],
    ["hw.initialOrientation", "Portrait"],
    ["hw.keyboard", "yes"],
    ["hw.lcd.density", "420"],
    ["hw.lcd.height", "2400"],
    ["hw.lcd.width", "1080"],
    ["hw.mainKeys", "no"],
    ["hw.ramSize", "1536"],
    ["hw.sdCard", "yes"],
    ["hw.sensors.orientation", "yes"],
    ["hw.sensors.proximity", "yes"],
    ["hw.trackBall", "no"],
    ["image.sysdir.1", systemImage.location],
    ["runtime.network.latency", "none"],
    ["runtime.network.speed", "full"],
    ["sdcard.size", "512M"],
    ["showDeviceFrame", "no"],
    ["tag.display", "Google Play"],
    ["tag.id", "google_apis_playstore"],
    ["vm.heapSize", "228"],
  ];
  const configIniContent = configIniData.map(([key, value]) => `${key}=${value}`).join("\n");
  await fs.promises.writeFile(configIni, configIniContent, "utf-8");
  return {
    id: `android-${avdId}`,
    platform: DevicePlatform.Android,
    avdId,
    modelId: modelId,
    systemName: systemImage.name,
    displayName: displayName,
    available: true, // TODO: there is no easy way to check if emulator is available, we'd need to parse config.ini
  } as DeviceInfo;
}
const UUID_REGEX = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;
async function getAvdIds(avdDirectory: string) {
  const { stdout } = await exec(EMULATOR_BINARY, ["-list-avds"], {
    env: { ANDROID_AVD_HOME: avdDirectory },
  });

  // filters out error messages and empty lines
  // https://github.com/react-native-community/cli/issues/1801#issuecomment-1980580355
  return stdout.split(EOL).filter((id) => UUID_REGEX.test(id));
}

export async function listEmulators() {
  const avdDirectory = getOrCreateAvdDirectory();
  const emulators = listEmulatorsForDirectory(avdDirectory);
  const oldAvdDirectory = getOldAvdDirectoryLocation();
  const oldEmulators = listEmulatorsForDirectory(oldAvdDirectory);

  const combinedEmulators = await Promise.all([emulators, oldEmulators]);

  return combinedEmulators[0].concat(combinedEmulators[1]);
}

async function listEmulatorsForDirectory(avdDirectory: string) {
  const avdIds = await getAvdIds(avdDirectory);
  const systemImages = await getAndroidSystemImages();
  return Promise.all(
    avdIds.map(async (avdId) => {
      const avdConfigPath = path.join(avdDirectory, `${avdId}.avd`, "config.ini");
      const { displayName, modelId, systemImageDir } = await parseAvdConfigIniFile(avdConfigPath);

      const systemImageName = systemImages.find(
        (image: AndroidSystemImageInfo) => image.location === systemImageDir
      )?.name;

      return {
        id: `android-${avdId}`,
        platform: DevicePlatform.Android,
        avdId,
        modelId: modelId,
        systemName: systemImageName ?? "Unknown",
        displayName: displayName,
        available: true, // TODO: there is no easy way to check if emulator is available, we'd need to parse config.ini
      } as DeviceInfo;
    })
  );
}

async function ensureOldEmulatorProcessExited(avdId: string) {
  let runningPid: string | undefined;
  const command = Platform.select({
    macos: "ps",
    windows:
      'powershell.exe "Get-WmiObject Win32_Process | Select-Object ProcessId, CommandLine | ConvertTo-Csv -NoTypeInformation"',
    linux: "ps",
  });
  const args = Platform.select({
    macos: ["-Ao", "pid,command"],
    windows: [],
    linux: ["-Ao", "pid,command"],
  });
  const subprocess = exec(command, args);
  const regexpPattern = new RegExp(`(\\d+).*qemu.*-avd ${avdId}`);
  lineReader(subprocess).onLineRead(async (line) => {
    const regExpResult = regexpPattern.exec(line);
    if (regExpResult) {
      runningPid = regExpResult[1];
    }
  });
  await subprocess;
  if (runningPid) {
    process.kill(Number(runningPid), 9);
  }
}

export async function renameEmulator(avdId: string, newDisplayName: string) {
  const avdDirectory = getOrCreateAvdDirectory();
  const avdLocation = path.join(avdDirectory, `${avdId}.avd`);
  const configIni = path.join(avdLocation, "config.ini");

  try {
    const oldConfig = await fs.promises.readFile(configIni, "utf-8");
    const config = oldConfig
      .split("\n")
      .map((line) => {
        if (line.startsWith("avd.ini.displayname=")) {
          return `avd.ini.displayname=${newDisplayName}`;
        }
        return line;
      })
      .join("\n");

    await fs.promises.writeFile(configIni, config, "utf-8");
  } catch (e) {
    throw new Error(`Failed to rename device`);
  }
}

export async function removeEmulator(avdId: string) {
  // ensure to kill emulator process before removing avd files used by that process
  if (Platform.OS === "windows") {
    await ensureOldEmulatorProcessExited(avdId);
  }

  const avdDirectory = getOrCreateAvdDirectory(avdId);
  const removeAvd = fs.promises.rm(path.join(avdDirectory, `${avdId}.avd`), {
    recursive: true,
  });
  const removeIni = fs.promises.rm(path.join(avdDirectory, `${avdId}.ini`));
  return Promise.all([removeAvd, removeIni])
    .catch(() => {
      /* ignore errors when removing */
    })
    .then(() => {});
}

async function parseAvdConfigIniFile(filePath: string) {
  const content = await fs.promises.readFile(filePath, "utf-8");

  let displayName: string | undefined;
  let modelId: string | undefined;
  let systemImageDir: string | undefined;
  content.split("\n").forEach((line: string) => {
    const [key, value] = line.split("=");
    switch (key) {
      case "avd.ini.displayname":
        displayName = value;
        break;
      case "hw.device.name":
        modelId = value;
        break;
      case "image.sysdir.1":
        systemImageDir = value.includes(ANDROID_HOME) ? value : path.join(ANDROID_HOME, value);
        break;
    }
  });
  if (!displayName || !modelId || !systemImageDir) {
    throw new Error(`Couldn't parse AVD ${filePath}`);
  }

  return { displayName, modelId, systemImageDir };
}

async function parseAvdIniFile(filePath: string) {
  const content = await fs.promises.readFile(filePath, "utf-8");

  const info: Partial<EmulatorProcessInfo> = {
    pid: parseInt(filePath.match(/^pid_(\d+)\.ini$/)?.[1] ?? "0"),
  };
  Logger.debug("Parsing ini file", filePath);

  content.split("\n").forEach((line: string) => {
    const [key, value] = line.split("=");
    switch (key) {
      case "port.serial":
        info.serialPort = parseInt(value);
        break;
      case "port.adb":
        info.adbPort = parseInt(value);
        break;
      case "avd.name":
        info.avdName = value;
        break;
      case "avdDir":
        info.avdDir = value;
        break;
      case "grpc.port":
        info.grpcPort = parseInt(value);
        break;
      case "grpc.token":
        info.grpcToken = value;
        break;
    }
  });

  return info as EmulatorProcessInfo;
}

async function waitForEmulatorOnline(serial: string, timeoutMs: number) {
  return new Promise<void>(async (resolve, reject) => {
    let process: ChildProcess | undefined;
    const timeout = setTimeout(() => {
      process?.kill(9);
      reject(new Error("Timeout waiting for emulator to boot"));
    }, timeoutMs);

    process = exec(ADB_PATH, [
      "-s",
      serial,
      "wait-for-device",
      "shell",
      "while [[ -z $(getprop sys.boot_completed) ]]; do sleep 0.5; done; input keyevent 82",
    ]);

    await process;

    // If booting device and building the application was fast enough, the emulators network internals
    // would not be loaded before the start of the application. This in turn would cause PackagerStatusCheck
    // (https://github.com/facebook/react-native/blob/main/packages/react-native/ReactAndroid/src/main/java/com/facebook/react/devsupport/PackagerStatusCheck.kt)
    // to fail and the application would think that there is no metro server.
    process = exec(ADB_PATH, [
      "-s",
      serial,
      "shell",
      `while ! ping -c 1 10.0.2.2>/dev/null 2>&1; do sleep 0.5; done;`,
    ]);

    await process;

    clearTimeout(timeout);
    resolve();
  });
}

function getOrCreateAvdDirectory(avd?: string) {
  const avdDirectory = getAvdDirectoryLocation(avd);
  if (!fs.existsSync(avdDirectory)) {
    fs.mkdirSync(avdDirectory, { recursive: true });
  }

  return avdDirectory;
}

function getOldAvdDirectoryLocation() {
  const oldAppCachesDir = getOldAppCachesDir();
  return path.join(oldAppCachesDir, "Devices", "Android", "avd");
}

function getAvdDirectoryLocation(avd?: string) {
  const appCachesDir = getAppCachesDir();
  const avdDirectory = path.join(appCachesDir, "Devices", "Android", "avd");
  if (!avd) {
    return avdDirectory;
  }

  const oldAvdDirectory = getOldAvdDirectoryLocation();
  if (!fs.existsSync(oldAvdDirectory)) {
    return avdDirectory;
  }
  const devices = fs.readdirSync(oldAvdDirectory);
  if (devices.includes(`${avd}.avd`)) {
    return oldAvdDirectory;
  }
  return avdDirectory;
}

function convertToAdbFontSize(size: DeviceSettings["contentSize"]): number {
  switch (size) {
    case "xsmall":
      return 0.75;
    case "small":
      return 0.85;
    case "normal":
      return 1;
    case "large":
      return 1.3;
    case "xlarge":
      return 1.4;
    case "xxlarge":
      return 1.5;
    case "xxxlarge":
      return 1.6;
  }
}

enum CPU_ARCH {
  X86 = "x86",
  X86_64 = "x86_64",
  ARM = "arm",
  ARM64 = "arm64",
}

function getNativeQemuArch() {
  switch (process.arch) {
    case "x64":
      return CPU_ARCH.X86_64;
    case "ia32":
      return CPU_ARCH.X86;
    case "arm":
      return CPU_ARCH.ARM;
    case "arm64":
      return CPU_ARCH.ARM64;
    default:
      throw new Error("Unsupported CPU architecture.");
  }
}
