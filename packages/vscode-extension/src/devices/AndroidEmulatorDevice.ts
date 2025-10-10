import path from "path";
import fs from "fs";
import { EOL } from "node:os";
import assert from "assert";
import { v4 as uuidv4 } from "uuid";
import { Preview } from "./preview";
import { REBOOT_TIMEOUT } from "./DeviceBase";
import { cancellableRetry } from "../utilities/retry";
import { getAppCachesDir, getNativeABI, getOldAppCachesDir } from "../utilities/common";
import { ANDROID_HOME } from "../utilities/android";
import { ChildProcess, exec, lineReader } from "../utilities/subprocess";
import { Logger } from "../Logger";
import { getAndroidSystemImages } from "../utilities/sdkmanager";
import { Platform } from "../utilities/platform";
import { CancelError, CancelToken } from "../utilities/cancelToken";
import { OutputChannelRegistry } from "../project/OutputChannelRegistry";
import {
  AndroidEmulatorInfo,
  AndroidSystemImageInfo,
  CameraSettings,
  DeviceInfo,
  DevicePlatform,
  DeviceSettings,
  DeviceType,
  Locale,
} from "../common/State";
import { ADB_PATH, AndroidDevice } from "./AndroidDevice";
import { DeviceAlreadyUsedError } from "./DeviceAlreadyUsedError";
import { DevicesProvider } from "./DevicesProvider";

export const EMULATOR_BINARY = path.join(
  ANDROID_HOME,
  "emulator",
  Platform.select({
    macos: "emulator",
    windows: "emulator.exe",
    linux: "emulator",
  })
);

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

export class AndroidEmulatorDevice extends AndroidDevice {
  private emulatorProcess: ChildProcess | undefined;

  constructor(
    deviceSettings: DeviceSettings,
    private readonly avdId: string,
    private readonly info: DeviceInfo,
    outputChannelRegistry: OutputChannelRegistry
  ) {
    super(deviceSettings, outputChannelRegistry);
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
    // If the emulator process does not shut down initially due to ongoing activities or processes,
    // a forced termination (kill signal) is sent after a certain timeout period.
    setTimeout(() => {
      this.emulatorProcess?.kill(9);
    }, DISPOSE_TIMEOUT);
  }

  async changeSettings(settings: DeviceSettings): Promise<boolean> {
    assert(this.serial, "Device serial is not set. Cannot change settings.");
    // Apply runtime settings that don't require boot
    await exec(ADB_PATH, [
      "-s",
      this.serial,
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
        this.serial,
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
        this.serial,
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
      await exec(ADB_PATH, ["-s", this.serial, "emu", "geo", "fix", long, lat]);
    }

    // Apply settings that require emulator reboot
    const updatedLocale = await this.maybeChangeLocale(settings.locale);
    const updatedCameraSettings =
      settings.camera !== undefined && (await this.maybeChangeCameraSettings(settings.camera));
    const shouldReboot = updatedLocale || updatedCameraSettings;

    // if the boot settings were changed, we need to restart the emulator
    return shouldReboot;
  }

  /**
   * Checks the current locale of the Android emulator device and updates it if necessary.
   *
   * @param locale - The desired locale to set on the device (e.g., "en_US").
   * @param deviceSerial - The serial number of the target Android emulator device.
   * @returns A promise that resolves to `true` if the locale was changed, or `false` if no change was needed.
   */
  private async maybeChangeLocale(locale: Locale): Promise<boolean> {
    assert(this.serial, "Device serial is not set. Cannot change locale.");
    const newLocale = locale.replace("_", "-");

    try {
      const { stdout: rawCurrentLocale } = await exec(ADB_PATH, [
        "-s",
        this.serial,
        "shell",
        "settings",
        "get",
        "system",
        "system_locales",
      ]);

      // if user did not use the device before it might not have system_locales property
      // as en-US is the default locale, used by the system, when no setting is provided
      // we assume that no value in stdout is the same as en-US on some devices
      // stdout is a string "null" instead of undefined so we need to handle it separately
      const currentLocale =
        rawCurrentLocale === "null" || rawCurrentLocale === undefined ? "en-US" : rawCurrentLocale;
      const needsUpdate = currentLocale !== newLocale;
      if (!needsUpdate) {
        return false; // no need to change locale
      }
    } catch (error) {
      Logger.warn("Failed to get current locale settings from the Android emulator.", error);
      return false;
    }

    try {
      await exec(ADB_PATH, [
        "-s",
        this.serial,
        "shell",
        "settings",
        "put",
        "system",
        "system_locales",
        newLocale,
      ]);

      // this is needed to make sure that changes will persist
      await exec(ADB_PATH, ["-s", this.serial, "shell", "sync"]);

      // TODO:  Find a way to change or remove persist.sys.locale without root access. note: removing the whole
      // data/property/persistent_properties file would also work as we persist device settings globally in Radon IDE
      const { stdout } = await exec(ADB_PATH, [
        "-s",
        this.serial,
        "shell",
        "getprop",
        "persist.sys.locale",
      ]);

      if (stdout) {
        Logger.warn(
          "Updating locale will not take effect as the device has altered locale via system settings which always takes precedence over the device setting the IDE uses."
        );
      }

      return true;
    } catch (error) {
      Logger.warn("Failed to apply locale settings changes to the Android emulator.", error);
      return false;
    }
  }

  /**
   * Checks and updates the camera settings in the Android emulator configuration file if necessary.
   *
   * @param cameraSettings - An object specifying the desired camera settings for the emulator.
   * @returns A promise that resolves to `true` if the configuration was updated, or `false` if no changes were necessary.
   */
  private async maybeChangeCameraSettings(cameraSettings: CameraSettings): Promise<boolean> {
    let configContent: string;
    try {
      configContent = await this.readConfigFile();
    } catch (error) {
      Logger.warn("Failed to read current emulator camera settings.", error);
      return false; // If we cannot read the config, we assume no changes are needed
    }
    const configLines = configContent.split("\n");
    let currentBackCamera = "emulated";
    let currentFrontCamera = "none";

    configLines.forEach((line: string) => {
      const [key, value] = line.split("=");
      if (key === "hw.camera.back") {
        currentBackCamera = value;
      } else if (key === "hw.camera.front") {
        currentFrontCamera = value;
      }
    });

    const backNeedsUpdate =
      cameraSettings?.back !== undefined && currentBackCamera !== cameraSettings.back;
    const frontNeedsUpdate =
      cameraSettings?.front !== undefined && currentFrontCamera !== cameraSettings.front;

    const needsUpdate = backNeedsUpdate || frontNeedsUpdate;
    if (!needsUpdate) {
      return false;
    }

    const newConfigLines = configLines.map((line) => {
      const [key] = line.split("=");
      if (backNeedsUpdate && key === "hw.camera.back") {
        return `hw.camera.back=${cameraSettings.back}`;
      }
      if (frontNeedsUpdate && key === "hw.camera.front") {
        return `hw.camera.front=${cameraSettings.front}`;
      }
      return line;
    });

    const newConfig = newConfigLines.join("\n");
    try {
      await this.writeConfigFile(newConfig);
    } catch (error) {
      Logger.warn(
        "Failed to write updated camera settings to the emulator configuration file.",
        error
      );
      return false; // If we cannot write the config, we assume no changes were made
    }
    return true;
  }

  private async readConfigFile(): Promise<string> {
    const avdDirectory = getAvdDirectoryLocation(this.avdId);
    const configIni = path.join(avdDirectory, `${this.avdId}.avd`, "config.ini");
    return await fs.promises.readFile(configIni, "utf-8");
  }

  private async writeConfigFile(configContent: string): Promise<void> {
    const avdDirectory = getAvdDirectoryLocation(this.avdId);
    const configIni = path.join(avdDirectory, `${this.avdId}.avd`, "config.ini");
    await fs.promises.writeFile(configIni, configContent, "utf-8");
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

  public async reboot() {
    super.reboot();
    const { promise, resolve } = Promise.withResolvers<void>();

    // Emulator might take a long time to exit gracefully, so we set a timeout
    // to forcefully reset the device if it doesn't exit within the specified time.
    const timeout = setTimeout(async () => {
      this.emulatorProcess?.off("exit", exitListener);
      await this.forcefullyResetDevice();
      resolve();
    }, REBOOT_TIMEOUT);

    const exitListener = async () => {
      clearTimeout(timeout);
      await this.internalBootDevice();
      resolve();
    };

    if (this.emulatorProcess) {
      this.emulatorProcess.on("exit", exitListener);
      this.emulatorProcess.kill();
    } else {
      await this.internalBootDevice();
      resolve();
    }

    return promise;
  }

  async bootDevice(): Promise<void> {
    await this.internalBootDevice();

    let shouldRestart = await this.changeSettings(this.deviceSettings);
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
          try {
            await waitForEmulatorOnline(emulatorSerial, 60000);
            resolve(emulatorSerial);
          } catch (error) {
            reject(new Error(`Emulator did not come online: ${error}`));
          }
        }
      });
    });

    this.serial = await initPromise;
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
    deviceType: DeviceType.Phone,
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

export async function listEmulators(): Promise<AndroidEmulatorInfo[]> {
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
      } as AndroidEmulatorInfo;
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
  const cancelToken = new CancelToken();
  const timeout = setTimeout(() => {
    cancelToken.cancel();
  }, timeoutMs);

  try {
    const ADB_WAIT_RETRIES = 3;
    const ADB_WAIT_RETRY_INTERVAL = 500;
    await cancellableRetry(
      () =>
        exec(ADB_PATH, [
          "-s",
          serial,
          "wait-for-device",
          "shell",
          "while [[ -z $(getprop sys.boot_completed) ]]; do sleep 0.5; done; input keyevent 82",
        ]),
      cancelToken,
      ADB_WAIT_RETRIES,
      ADB_WAIT_RETRY_INTERVAL
    );

    // If booting device and building the application was fast enough, the emulators network internals
    // would not be loaded before the start of the application. This in turn would cause PackagerStatusCheck
    // (https://github.com/facebook/react-native/blob/main/packages/react-native/ReactAndroid/src/main/java/com/facebook/react/devsupport/PackagerStatusCheck.kt)
    // to fail and the application would think that there is no metro server.
    await cancelToken.adapt(
      exec(ADB_PATH, [
        "-s",
        serial,
        "shell",
        `while ! ping -c 1 10.0.2.2>/dev/null 2>&1; do sleep 0.5; done;`,
      ])
    );

    clearTimeout(timeout);
  } catch (error) {
    if (error instanceof CancelError) {
      throw new Error("Timeout waiting for emulator to boot");
    }
    throw error;
  }
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

export class AndroidEmulatorProvider implements DevicesProvider<AndroidEmulatorInfo> {
  constructor(private outputChannelRegistry: OutputChannelRegistry) {}

  public async acquireDevice(
    deviceInfo: DeviceInfo,
    deviceSettings: DeviceSettings
  ): Promise<AndroidEmulatorDevice | undefined> {
    if (deviceInfo.platform !== DevicePlatform.Android || !deviceInfo.emulator) {
      return undefined;
    }

    const emulators = await listEmulators();
    const emulatorInfo = emulators.find((device) => device.id === deviceInfo.id);
    if (!emulatorInfo || emulatorInfo.platform !== DevicePlatform.Android) {
      throw new Error(`Emulator ${deviceInfo.id} not found`);
    }
    const device = new AndroidEmulatorDevice(
      deviceSettings,
      emulatorInfo.avdId,
      emulatorInfo,
      this.outputChannelRegistry
    );

    if (await device.acquire()) {
      return device;
    }

    device.dispose();
    throw new DeviceAlreadyUsedError();
  }

  public listDevices() {
    const emulators = listEmulators().catch((e) => {
      Logger.error("Error fetching emulators", e);
      return [];
    });
    return emulators;
  }
}
