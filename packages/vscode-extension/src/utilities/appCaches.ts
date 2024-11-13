import { join } from "path";
import fs from "fs";
import { getOrCreateAppsCachesDir } from "./common";
import { createHash } from "crypto";
import { getAppRootFolder } from "./extensionContext";
import { Logger } from "../Logger";

function getAppRootPathHash() {
  return createHash("md5").update(getAppRootFolder()).digest("hex");
}

function getAppCachesPath() {
  const appCachesPath = join(getOrCreateAppsCachesDir(), getAppRootPathHash());
  return appCachesPath;
}

/**
 * This function gets app level caches for the provided key.
 * @param key
 * @returns the value of the cache for key
 */
export function getAppCache(key: string) {
  const appCachesPath = getAppCachesPath();
  let caches;
  try {
    caches = JSON.parse(fs.readFileSync(appCachesPath).toString());
  } catch (e) {
    Logger.warn(`Error parsing caches file for app ${getAppRootFolder()}`, e);
    return undefined;
  }
  if (!caches[key]) {
    Logger.debug(`No app caches found for key: ${key}}`);
    return undefined;
  }
  return caches[key];
}

/**
 * This function stores app level caches for the provided key.
 * @param key
 * @param value
 * @returns the new value that was set
 */
export function storeAppCache(key: string, value: string) {
  const appCachesPath = getAppCachesPath();
  let oldCaches;
  if (fs.existsSync(appCachesPath)) {
    try {
      oldCaches = JSON.parse(fs.readFileSync(appCachesPath).toString());
    } catch (e) {
      Logger.warn(`Error parsing cold caches file for app ${getAppRootFolder()}`, e);
      return undefined;
    }
  } else {
    oldCaches = {};
  }

  const newCashes = {
    ...oldCaches,
    [key]: value,
  };

  try {
    fs.writeFileSync(appCachesPath, JSON.stringify(newCashes));
  } catch (e) {
    Logger.warn(`Error writing new caches file for app ${getAppRootFolder()}`, e);
    return undefined;
  }

  return newCashes;
}

/**
 * This function removes app level caches for the provided key.
 * @param key
 */
export function removeAppCache(key: string) {
  const appCachesPath = getAppCachesPath();
  let oldCaches;
  try {
    oldCaches = JSON.parse(fs.readFileSync(appCachesPath).toString());
  } catch (e) {
    Logger.warn(`Error parsing old caches file for app ${getAppRootFolder()}`, e);
    return;
  }
  const newCashes = {
    ...oldCaches,
    [key]: undefined,
  };

  try {
    fs.writeFileSync(appCachesPath, JSON.stringify(newCashes));
  } catch (e) {
    Logger.warn(`Error writing new caches file for app ${getAppRootFolder()}`, e);
    return;
  }
}
