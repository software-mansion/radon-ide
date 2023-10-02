import { ChildProcess } from "child_process";
import { Preview } from "./preview";
import { DeviceBase } from "./DeviceBase";

const execa = require("execa");
const readline = require("readline");
const child_process = require("child_process");
const os = require("os");
const path = require("path");
const fs = require("fs");

const AVD_NAME = "ReactNativePreviewVSCode";
const PREFFERED_SYSTEM_IMAGE = "android-33";

const ANDROID_HOME = process.env.ANDROID_HOME || path.join(os.homedir(), "Library/Android/sdk");
const ADB_PATH = path.join(ANDROID_HOME, "platform-tools", "adb");
const AAPT_PATH = path.join(ANDROID_HOME, "build-tools", "33.0.0", "aapt");

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

  async bootDevice() {
    if (this.emulatorProcess) {
      return;
    }
    const { process, serial } = await findOrCreateEmulator(this.avdDirectory);
    this.emulatorProcess = process;
    this.serial = serial;
  }

  async launchApp(packageName: string, metroPort: number, devtoolsPort: number) {
    await execa(ADB_PATH, ["-s", this.name, "reverse", `tcp:${metroPort}`, `tcp:${metroPort}`]);
    await execa(ADB_PATH, [
      "-s",
      this.name,
      "reverse",
      `tcp:${devtoolsPort}`,
      `tcp:${devtoolsPort}`,
    ]);
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
    await execa(ADB_PATH, ["-s", this.name, "install", "-r", apkPath]);
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

  fs.mkdirSync(avdDirectory, { recursive: true });

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
        await waitForEmulatorOnline(emulatorSerial, 10000);
        resolve({ process: subprocess, serial: emulatorSerial });
      }
      console.log(`emu: ${line}`);
    });
  });
  return initPromise;
}

async function findOrCreateEmulator(avdDirectory: string) {
  // first, we check if emulator already exists
  if (!fs.existsSync(avdDirectory)) {
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
