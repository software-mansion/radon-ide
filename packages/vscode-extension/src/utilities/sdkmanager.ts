import path from "path";
import { ANDROID_HOME } from "./android";
import { exec } from "./subprocess";
import { Logger } from "../Logger";
import { AndroidSystemImageInfo } from "../common/DeviceManager";
import { readdirSync, statSync } from "fs";
export const SYSTEM_IMAGES_PATH = path.join(ANDROID_HOME, "system-images");

const ACCEPTED_SYSTEM_IMAGES_TYPES = ["default", "google_apis_playstore", "google_apis"];

const ANDROID_CODENAMES_TO_API_LEVELS = {
  s: 31,
  r: 30,
  q: 29,
  pie: 28,
  oreo: 27,
  nougat: 24,
  marshmallow: 23,
  lollipop: 21,
  kitkat: 19,
};

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

function recursiveSystemImagePathsSearch(
  directory: string,
  currentDepth: number = 0,
  maxDepth: number = 3
): string[] {
  const results: string[] = [];

  if (currentDepth > maxDepth) {
    return results;
  }

  const files = readdirSync(directory);

  for (const file of files) {
    const filePath = path.join(directory, file);
    const isDirectory = statSync(filePath).isDirectory();
    if (!isDirectory) continue;
    // Skip image directories which are not present in the accepted types (on the 2nd depth level only)
    if (currentDepth === 1 && !ACCEPTED_SYSTEM_IMAGES_TYPES.includes(file)) continue;

    if (currentDepth === maxDepth) {
      results.push(filePath);
    }
    results.push(...recursiveSystemImagePathsSearch(filePath, currentDepth + 1, maxDepth));
  }

  return results.map((filepath) => filepath.replace(SYSTEM_IMAGES_PATH + "/", ""));
}

export async function getAndroidSystemImages(): Promise<AndroidSystemImageInfo[]> {
  const filepaths = recursiveSystemImagePathsSearch(SYSTEM_IMAGES_PATH);
  const images = filepaths.map(mapToSystemImageInfo);
  images.sort((a, b) => b.apiLevel - a.apiLevel);
  // Temporary solution to limit the number of images, currently we want to show last 3 images
  const latestImages = images.slice(0, 3);
  return latestImages;
}

// example input: 'android-34/default/arm64-v8a/data'
function mapToSystemImageInfo(systemImagePath: string) {
  const [imageName, systemImageType, arch] = systemImagePath.split("/");
  const apiLevelCode = imageName.split("-")[1];
  let apiLevel = parseInt(apiLevelCode);
  if (isNaN(apiLevel)) {
    apiLevel =
      ANDROID_CODENAMES_TO_API_LEVELS[
        apiLevelCode.toLowerCase() as keyof typeof ANDROID_CODENAMES_TO_API_LEVELS
      ];
  }
  const androidVersion = mapApiLevelToAndroidVersion(apiLevel);

  let apisSuffix = "";
  if (systemImageType === "google_apis_playstore") {
    apisSuffix = " with Google Play";
  } else if (systemImageType === "google_apis") {
    apisSuffix = " with Google APIs";
  }

  const name = `Android ${androidVersion} (API Level ${apiLevel}${apisSuffix})`;
  return {
    name,
    location: path.join(SYSTEM_IMAGES_PATH, imageName, systemImageType, arch),
    apiLevel,
  } as AndroidSystemImageInfo;
}

export async function installSystemImages(
  sysImagePaths: string[],
  onLine?: (line: string) => void
) {
  return exec(`sdkmanager ${sysImagePaths.map((imgPath) => `"${imgPath}"`).join(" ")}`, []);
}

export async function removeSystemImages(sysImagePaths: string[]) {
  const removalPromises = sysImagePaths.map((sysImagePath) => {
    const pathToRemove = path.join(ANDROID_HOME, sysImagePath);
    Logger.debug("Removing directory", pathToRemove);
    return exec("rm", ["-rf", pathToRemove]);
  });
  return Promise.all(removalPromises);
}
