import readline from "readline";
import path from "path";
import { ANDROID_HOME } from "./android";
import { execaWithLog, spawnWithLog } from "./subprocess";
import { Logger } from "../Logger";

const SDKMANAGER_BIN_PATH = path.join(ANDROID_HOME, "cmdline-tools", "latest", "bin", "sdkmanager");

interface SdkRepositoryEntry {
  path: string;
  version: string;
  description: string;
  location?: string;
}

export interface AndroidImageEntry extends SdkRepositoryEntry {
  apiLevel: number;
}

// Example image path: "system-images;android-31;default;x86_64"
function getApiLevelFromImagePath(imagePath: string): number {
  return parseInt(imagePath.split(";")[1].split("-")[1]);
}

async function runSdkManagerList() {
  const { stdout } = await execaWithLog(SDKMANAGER_BIN_PATH, ["--list"]);
  return stdout;
}

function filterOtherEntries(entry: SdkRepositoryEntry) {
  return entry.path.startsWith("system-images");
}

function mapToImageEntry(imageEntry: SdkRepositoryEntry) {
  return { ...imageEntry, apiLevel: getApiLevelFromImagePath(imageEntry.path) };
}

async function getInstalledAndroidSdkEntries(): Promise<
  [SdkRepositoryEntry[], SdkRepositoryEntry[]]
> {
  const stdout = await runSdkManagerList();
  const rawTable = stdout.split("Installed packages:")[1];
  const [parsedInstalled, parsedAvailable] = rawTable.split("Available Packages:").map((rawText) =>
    rawText
      .split("\n")
      .filter((line) => !!line.length)
      .slice(2)
      .map((line) => line.split("|").map((cell) => cell.trim()))
  );

  const installedEntries = parsedInstalled.map((installed) => ({
    path: installed[0],
    version: installed[1],
    description: installed[2],
    location: installed[3],
  }));

  const availableEntries = parsedAvailable.map((available) => ({
    path: available[0],
    version: available[1],
    description: available[2],
  }));

  return [installedEntries, availableEntries];
}

export async function getAndroidSystemImages(): Promise<
  [AndroidImageEntry[], AndroidImageEntry[]]
> {
  const [installedEntries, availableEntries] = await getInstalledAndroidSdkEntries();
  const installedImages = installedEntries
    .filter(filterOtherEntries)
    .map(mapToImageEntry)
    .filter((image) => !!image.apiLevel);

  const availableImages = availableEntries
    .filter(filterOtherEntries)
    .map(mapToImageEntry)
    .filter((image) => !!image.apiLevel);

  return [installedImages, availableImages];
}

export async function installSystemImages(
  sysImagePaths: string[],
  onLine?: (line: string) => void
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const downloadProcess = spawnWithLog(
      `sdkmanager ${sysImagePaths.map((imgPath) => `"${imgPath}"`).join(" ")}`,
      [],
      {
        shell: true,
      }
    );

    if (onLine && downloadProcess.stdout) {
      const rl = readline.createInterface({
        input: downloadProcess.stdout,
      });

      rl.on("line", onLine);
    }

    downloadProcess.on("exit", (code) => {
      if (code !== 0) {
        reject(new Error(`Command exited with code ${code}`));
      } else {
        resolve();
      }
    });

    downloadProcess.on("error", (err) => {
      reject(err);
    });
  });
}

export async function removeSystemImages(sysImagePaths: string[]) {
  const removalPromises = sysImagePaths.map((sysImagePath) => {
    const pathToRemove = path.join(ANDROID_HOME, sysImagePath);
    Logger.log(`Removing directory ${pathToRemove}`);
    return execaWithLog(`rm -rf ${pathToRemove}`);
  });
  return Promise.all(removalPromises);
}

export async function checkSdkManagerInstalled() {
  try {
    await execaWithLog(SDKMANAGER_BIN_PATH, ["--version"]);
    return true;
  } catch (_) {
    return false;
  }
}
