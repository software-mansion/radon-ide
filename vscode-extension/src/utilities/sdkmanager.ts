import readline from "readline";
import path from "path";
import { ANDROID_HOME } from "./android";
import { exec } from "./subprocess";
import { Logger } from "../Logger";
import { CPU_ARCHITECTURE, getCpuArchitecture } from "./common";

export const SDKMANAGER_BIN_PATH = path.join(
  ANDROID_HOME,
  "cmdline-tools",
  "latest",
  "bin",
  "sdkmanager"
);

const ACCEPTED_SYSTEM_IMAGES_TYPES = ["default", "google_apis_playstore", "google_apis"];

interface SdkRepositoryEntry {
  path: string;
  version: string;
  description: string;
  location?: string;
}

export interface AndroidImageEntry extends SdkRepositoryEntry {
  apiLevel: number;
  androidVersion: number | undefined;
  imageType: string;
}

// Temporary solution due to sdkmanager not having information about android version.
function mapApiLevelToAndroidVersion(apiLevel: number): number | undefined {
  switch (apiLevel) {
    case 34:
      return 14;
    case 33:
      return 13;
    case 32:
    case 31:
      return 12;
    case 30:
      return 11;
    case 29:
      return 10;
    case 28:
      return 9;
    default:
      undefined;
  }
}

// Example image path: "system-images;android-31;default;x86_64"
function getApiLevelFromImagePath(imagePath: string): number {
  return parseInt(imagePath.split(";")[1].split("-")[1]);
}

async function runSdkManagerList() {
  const { stdout } = await exec(SDKMANAGER_BIN_PATH, ["--list"]);
  return stdout;
}

function filterOtherEntriesTypes(entry: SdkRepositoryEntry) {
  return entry.path.startsWith("system-images");
}

function filterOtherOsVersions(cpuArchitecture: CPU_ARCHITECTURE) {
  return (entry: SdkRepositoryEntry) => entry.path.split(";")[3] === cpuArchitecture;
}

function filterOlderApiLevels(entry: AndroidImageEntry) {
  return entry.apiLevel >= 28;
}

function filterSystemImageTypes(entry: SdkRepositoryEntry) {
  const systemImageType = entry.path.split(";")[2];
  return ACCEPTED_SYSTEM_IMAGES_TYPES.includes(systemImageType);
}

function mapToImageEntry(imageEntry: SdkRepositoryEntry) {
  const apiLevel = getApiLevelFromImagePath(imageEntry.path);
  return {
    ...imageEntry,
    apiLevel: apiLevel,
    androidVersion: mapApiLevelToAndroidVersion(apiLevel),
    imageType: imageEntry.path.split(";")[2],
  };
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
  const cpuArchitecture = getCpuArchitecture();
  const installedImages = installedEntries
    .filter(filterOtherEntriesTypes)
    .filter(filterOtherOsVersions(cpuArchitecture))
    .filter(filterSystemImageTypes)
    .map(mapToImageEntry)
    .filter((image) => !!image.apiLevel)
    .filter(filterOlderApiLevels);

  const availableImages = availableEntries
    .filter(filterOtherEntriesTypes)
    .filter(filterOtherOsVersions(cpuArchitecture))
    .filter(filterSystemImageTypes)
    .map(mapToImageEntry)
    .filter((image) => !!image.apiLevel)
    .filter(filterOlderApiLevels);

  return [installedImages, availableImages];
}

export async function installSystemImages(
  sysImagePaths: string[],
  onLine?: (line: string) => void
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const downloadProcess = exec(
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
    Logger.debug("Removing directory", pathToRemove);
    return exec("rm", ["-rf", pathToRemove]);
  });
  return Promise.all(removalPromises);
}
