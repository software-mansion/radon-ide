import { ChildProcess } from "child_process";
import { Preview } from "./preview";
import { DeviceBase, DeviceSettings } from "./DeviceBase";
import execa from "execa";
import readline from "readline";
import child_process from "child_process";
import os from "os";
import path from "path";
import fs from "fs";
import xml2js from "xml2js";
import { retry } from "../utilities/retry";

const AVD_NAME = "ReactNativePreviewVSCode";
const PREFFERED_SYSTEM_IMAGE = "android-33";

const ANDROID_HOME = process.env.ANDROID_HOME || path.join(os.homedir(), "Library/Android/sdk");
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
  private avdDirectory = getOrCreateAvdDirectory();
  private emulatorProcess: ChildProcess | undefined;
  private serial: string | undefined;

  get name() {
    return this.serial ?? "emulator-unknown";
  }

  public dispose(): void {
    super.dispose();
    this.emulatorProcess?.kill();
  }

  async changeSettings(settings: DeviceSettings) {
    await execa(ADB_PATH, [
      "-s",
      this.name,
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
      return;
    }
    const { process, serial } = await findOrCreateEmulator(this.avdDirectory);
    this.emulatorProcess = process;
    this.serial = serial;
  }

  async configureMetroPort(packageName: string, metroPort: number) {
    // read preferences
    let prefs: any;
    try {
      const { stdout } = await execa(ADB_PATH, [
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
    // add new debug_http_host record poiting to 10.0.2.2:metroPort (localhost from emulator)
    prefs.map.string.push({ $: { name: "debug_http_host" }, _: `10.0.2.2:${metroPort}` });
    const prefsXML = new xml2js.Builder().buildObject(prefs);

    // write prefs
    await execa(
      ADB_PATH,
      [
        "shell",
        `run-as ${packageName} sh -c 'mkdir -p /data/data/${packageName}/shared_prefs && cat > /data/data/${packageName}/shared_prefs/${packageName}_preferences.xml'`,
      ],
      {
        // pass serialized prefs as input:
        input: prefsXML,
      }
    );
  }

  async launchApp(packageName: string, metroPort: number) {
    await this.configureMetroPort(packageName, metroPort);
    await execa(ADB_PATH, [
      "-s",
      this.name,
      "shell",
      "monkey",
      "-p",
      packageName,
      "-c",
      "android.intent.category.LAUNCHER",
      "1",
    ]);
  }

  async installApp(apkPath: string) {
    // adb install sometimes fails because we call it too early after the device is initialized.
    // we haven't found a better way to test if device is ready and already wait for boot_completed
    // flag in waitForEmulatorOnline. The workaround therefore is to retry install command.
    await retry(() => execa(ADB_PATH, ["-s", this.name, "install", "-r", apkPath]), 2, 1000);
  }

  makePreview(): Preview {
    return new Preview(["android", this.name!]);
  }
}

async function getPreferredSystemImage() {
  const appCachesDir = path.join(
    os.homedir(),
    "Library",
    "Caches",
    "com.swmansion.react-native-preview-vscode"
  );
  const sysImagesDirectory = path.join(appCachesDir, "Devices", "Android", "system-images");
  const sysImageLocation = path.join(sysImagesDirectory, PREFFERED_SYSTEM_IMAGE);
  if (!fs.existsSync(sysImageLocation)) {
    // TODO: download and unzip
    throw new Error("Downloading images is not yet supported.");
  }

  return [PREFFERED_SYSTEM_IMAGE, sysImageLocation as string];
}

async function createEmulator(avdDirectory: string) {
  const [sysImageName, sysImageLocation] = await getPreferredSystemImage();
  const avdIni = path.join(avdDirectory, AVD_NAME + ".ini");
  const avdLocation = path.join(avdDirectory, AVD_NAME + ".avd");
  const configIni = path.join(avdLocation, "config.ini");

  fs.mkdirSync(avdLocation, { recursive: true });

  const avdIniData = [
    ["avd.ini.encoding", "UTF-8"],
    ["path", avdLocation],
    ["target", sysImageName],
  ];
  const avdIniContent = avdIniData.map(([key, value]) => `${key}=${value}`).join("\n");
  await fs.promises.writeFile(avdIni, avdIniContent, "utf-8");

  const configIniData = [
    ["AvdId", "ReactNativePreviewVSCode"],
    ["PlayStore.enabled", "true"],
    ["abi.type", "arm64-v8a"],
    ["avd.ini.displayname", "ReactNativePreviewVSCode"],
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
    ["hw.cpu.arch", "arm64"],
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
    ["image.sysdir.1", sysImageLocation],
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
}

async function startEmulator(avdDirectory: string) {
  const emulatorBinary = path.join(ANDROID_HOME, "emulator", "emulator");

  const subprocess = child_process.spawn(
    emulatorBinary,
    ["-avd", AVD_NAME, "-no-window", "-no-audio", "-no-boot-anim", "-grpc-use-token"],
    { env: { ...process.env, ANDROID_AVD_HOME: avdDirectory } }
  );

  const rl = readline.createInterface({
    input: subprocess!.stdout,
    output: process.stdout,
    terminal: false,
  });

  const initPromise = new Promise<{ process: ChildProcess; serial: string }>((resolve, reject) => {
    rl.on("line", async (line: string) => {
      if (line.includes("Advertising in:")) {
        const match = line.match(/Advertising in: (\S+)/);
        const iniFile = match![1];
        const emulatorInfo = await parseAvdIniFile(iniFile);
        const emulatorSerial = `emulator-${emulatorInfo.serialPort}`;
        await waitForEmulatorOnline(emulatorSerial, 60000);
        resolve({ process: subprocess, serial: emulatorSerial });
      }
      console.log(`emu: ${line}`);
    });
  });
  return initPromise;
}

async function findOrCreateEmulator(avdDirectory: string) {
  // first, we check if emulator already exists
  if (!fs.existsSync(path.join(avdDirectory, AVD_NAME + ".ini"))) {
    await createEmulator(avdDirectory);
  }

  // otherwise if emulator already exists, we try to launch it
  return await startEmulator(avdDirectory);
}

async function parseAvdIniFile(filePath: string) {
  const content = await fs.promises.readFile(filePath, "utf-8");

  const info: Partial<EmulatorProcessInfo> = {
    pid: parseInt(filePath.match(/^pid_(\d+)\.ini$/)?.[1] ?? "0"),
  };

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

async function sleep(timeoutMs: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, timeoutMs);
  });
}

async function waitForEmulatorOnline(serial: string, timeoutMs: number): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const isOnline = await checkEmulatorOnline(serial);
    if (isOnline) {
      return true;
    }
    await sleep(500);
  }
  return false;
}

async function checkEmulatorOnline(serial: string): Promise<boolean> {
  try {
    const { stdout } = await execa(ADB_PATH, ["-s", serial, "get-state"]);
    if (stdout.trim() === "device") {
      const { stdout } = await execa(ADB_PATH, [
        "-s",
        serial,
        "shell",
        "getprop",
        "sys.boot_completed",
      ]);
      if (stdout.trim() === "1") {
        return true;
      }
    }
  } catch (error) {
    // do nothing
  }
  return false;
}

function getOrCreateAvdDirectory() {
  const appCachesDir = path.join(
    os.homedir(),
    "Library",
    "Caches",
    "com.swmansion.react-native-preview-vscode"
  );
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
