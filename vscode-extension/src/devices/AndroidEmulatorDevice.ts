import { Preview } from "./preview";
import { DeviceBase } from "./DeviceBase";
import readline from "readline";
import os from "os";
import path from "path";
import fs from "fs";
import xml2js from "xml2js";
import { retry } from "../utilities/retry";
import { getAppCachesDir, getCpuArchitecture } from "../utilities/common";
import { ANDROID_HOME } from "../utilities/android";
import { ChildProcess, exec } from "../utilities/subprocess";
import { v4 as uuidv4 } from "uuid";
import { BuildResult } from "../builders/BuildManager";
import { AndroidSystemImageInfo, DeviceInfo, Platform } from "../common/DeviceManager";
import { Logger } from "../Logger";
import { DeviceSettings } from "../common/Project";
import { getAndroidSystemImages } from "../utilities/sdkmanager";

export const EMULATOR_BINARY = path.join(ANDROID_HOME, "emulator", "emulator");
const ADB_PATH = path.join(ANDROID_HOME, "platform-tools", "adb");

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

  constructor(private readonly avdId: string) {
    super();
  }

  public dispose(): void {
    super.dispose();
    this.emulatorProcess?.kill();
  }

  async changeSettings(settings: DeviceSettings) {
    await exec(ADB_PATH, [
      "-s",
      this.serial!,
      "shell",
      "settings",
      "put",
      "system",
      "font_scale",
      convertToAdbFontSize(settings.contentSize).toString(),
    ]);
  }

  async bootDevice() {
    if (this.emulatorProcess) {
      this.emulatorProcess.kill(9);
    }

    const avdDirectory = getOrCreateAvdDirectory();
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
      ],
      { env: { ...process.env, ANDROID_AVD_HOME: avdDirectory } }
    );
    this.emulatorProcess = subprocess;

    const initPromise = new Promise<string>((resolve, reject) => {
      subprocess.catch((reason) => reject(reason));
      subprocess.then(() => {
        // we expect the process to produce an expected output that we listed for
        // below and resolve the promise earlier. However, if the process exists
        // and the promise is still not resolved we should reject it such that we
        // don't hold other code waiting for it indefinitely.
        reject(new Error("Emulator process exited without producing expected output"));
      });

      const rl = readline.createInterface({
        input: subprocess.stdout!,
        output: process.stdout,
        terminal: false,
      });

      rl.on("line", async (line: string) => {
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

  async configureMetroPort(packageName: string, metroPort: number) {
    // read preferences
    let prefs: any;
    try {
      const { stdout } = await exec(ADB_PATH, [
        "-s",
        this.serial!,
        "shell",
        "run-as",
        packageName,
        "cat",
        `/data/data/${packageName}/shared_prefs/${packageName}_preferences.xml`,
      ]);
      prefs = await xml2js.parseStringPromise(stdout, { explicitArray: true });
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

  async launchApp(build: BuildResult, metroPort: number) {
    if (build.platform !== Platform.Android) {
      throw new Error("Invalid platform");
    }
    await this.configureMetroPort(build.packageName, metroPort);
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

  async installApp(build: BuildResult, forceReinstall: boolean) {
    if (build.platform !== Platform.Android) {
      throw new Error("Invalid platform");
    }
    // adb install sometimes fails because we call it too early after the device is initialized.
    // we haven't found a better way to test if device is ready and already wait for boot_completed
    // flag in waitForEmulatorOnline. But even after that even is delivered, adb install also sometimes
    // fails claiming it is too early. The workaround therefore is to retry install command.
    if (forceReinstall) {
      try {
        await retry(
          () => exec(ADB_PATH, ["-s", this.serial!, "uninstall", build.packageName]),
          2,
          1000
        );
      } catch (e) {
        Logger.error("Error while uninstalling will be ignored", e);
      }
    }
    await retry(
      () => exec(ADB_PATH, ["-s", this.serial!, "install", "-r", build.apkPath]),
      2,
      1000
    );
  }

  makePreview(): Preview {
    return new Preview(["android", this.serial!]);
  }
}

export async function createEmulator(displayName: string, systemImage: AndroidSystemImageInfo) {
  const avdDirectory = getOrCreateAvdDirectory();
  const avdId = uuidv4();
  const avdIni = path.join(avdDirectory, `${avdId}.ini`);
  const avdLocation = path.join(avdDirectory, `${avdId}.avd`);
  const configIni = path.join(avdLocation, "config.ini");
  const cpuArchitecture = getCpuArchitecture();

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
    ["abi.type", cpuArchitecture],
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
    ["hw.cpu.arch", os.arch()],
    ["hw.cpu.ncore", "4"],
    ["hw.dPad", "no"],
    ["hw.device.hash2", "MD5:3db3250dab5d0d93b29353040181c7e9"],
    ["hw.device.manufacturer", "Google"],
    ["hw.device.name", "pixel_7"],
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
    platform: Platform.Android,
    avdId,
    name: displayName,
    systemName: systemImage.name,
    available: true, // TODO: there is no easy way to check if emulator is available, we'd need to parse config.ini
  } as DeviceInfo;
}

export async function listEmulators() {
  const avdDirectory = getOrCreateAvdDirectory();
  const { stdout } = await exec(EMULATOR_BINARY, ["-list-avds"], {
    env: { ...process.env, ANDROID_AVD_HOME: avdDirectory },
  });
  const avdIds = stdout.split("\n").filter((avdId) => !!avdId);
  const [systemImages] = await getAndroidSystemImages();
  return Promise.all(
    avdIds.map(async (avdId) => {
      const avdConfigPath = path.join(avdDirectory, `${avdId}.avd`, "config.ini");
      const { displayName, systemImageDir } = await parseAvdConfigIniFile(avdConfigPath);
      const systemImageName = systemImages.find((image) => image.location === systemImageDir)?.name;
      return {
        id: `android-${avdId}`,
        platform: Platform.Android,
        avdId,
        name: displayName,
        systemName: systemImageName ?? "Unknown",
        available: true, // TODO: there is no easy way to check if emulator is available, we'd need to parse config.ini
      } as DeviceInfo;
    })
  );
}

export function removeEmulator(avdId: string) {
  const avdDirectory = getOrCreateAvdDirectory();
  const removeAvd = fs.promises.rmdir(path.join(avdDirectory, `${avdId}.avd`), {
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
  let systemImageDir: string | undefined;
  content.split("\n").forEach((line: string) => {
    const [key, value] = line.split("=");
    switch (key) {
      case "avd.ini.displayname":
        displayName = value;
        break;
      case "image.sysdir.1":
        systemImageDir = value;
        break;
    }
  });

  if (!displayName || !systemImageDir) {
    throw new Error(`Couldn't parse AVD ${filePath}`);
  }

  return { displayName, systemImageDir };
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
  await exec(ADB_PATH, [
    "-s",
    serial,
    "wait-for-device",
    "shell",
    "while [[ -z $(getprop sys.boot_completed) ]]; do sleep 0.5; done; input keyevent 82",
  ]);
}

function getOrCreateAvdDirectory() {
  const appCachesDir = getAppCachesDir();
  const avdDirectory = path.join(appCachesDir, "Devices", "Android", "avd");
  if (!fs.existsSync(avdDirectory)) {
    fs.mkdirSync(avdDirectory, { recursive: true });
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
