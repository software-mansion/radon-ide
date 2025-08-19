import fs from "fs";
import assert from "assert";
import crypto from "crypto";
import { Logger } from "../Logger";
import { extensionContext } from "../utilities/extensionContext";
import { IOSBuildResult } from "./buildIOS";
import { AndroidBuildResult } from "./buildAndroid";
import { calculateAppHash } from "../utilities/common";
import { BuildResult } from "./BuildManager";
import { FingerprintOptions, FingerprintProvider } from "../project/FingerprintProvider";
import { DevicePlatform } from "../common/State";

const ANDROID_BUILD_CACHE_KEY = "android_build_cache";
const BASE_IOS_BUILD_CACHE_KEY = "ios_build_cache";
// Add a key for new builds that support iPad since 1.10.0
// This is to ensure that old cached iOS builds that do not support iPad
// (made before 1.10.0) are not used when the user opens a project using iPad
// New builds support both iPhone and iPad, without having to rebuild,
// so we can use the same cache key from that point on
const IPAD_SUPPORT_BUILD_CACHE_KEY = "ipad_support_build_cache";
// Add a key for new builds that support iOS supported orientations for >1.10.0
// to invalidate old builds that do not have supportedInterfaceOrientations field
const IOS_SUPPORTED_ORIENTATIONS_KEY = "ios_supported_orientations";
const IOS_BUILD_CACHE_KEY =
  BASE_IOS_BUILD_CACHE_KEY + IPAD_SUPPORT_BUILD_CACHE_KEY + IOS_SUPPORTED_ORIENTATIONS_KEY;

export type BuildCacheInfo = {
  fingerprint: string;
  buildResult: AndroidBuildResult | IOSBuildResult;
};

export interface CacheKey {
  platform: DevicePlatform;
  appRoot: string;
  env: Record<string, string>;
}

function hashEnvironment(env: Record<string, string>) {
  const envHash = crypto.createHash("md5");
  const envEntries = Object.entries(env).sort(([k], [k2]) => k.localeCompare(k2));
  envEntries.map(([k, v]) => `${k}=${v}`).forEach((entry) => envHash.update(entry));
  return envHash.digest("hex");
}

function stringifyCacheKey({ platform, appRoot, env }: CacheKey) {
  const keyPrefix =
    platform === DevicePlatform.Android ? ANDROID_BUILD_CACHE_KEY : IOS_BUILD_CACHE_KEY;
  const envHash = hashEnvironment(env);

  return `${keyPrefix}:${appRoot}:${envHash}`;
}

export class BuildCache {
  constructor(private readonly fingerprintProvider: FingerprintProvider) {}

  /**
   * Passed fingerprint should be calculated at the time build is started.
   */
  public async storeBuild(buildFingerprint: string, cacheKey: CacheKey, build: BuildResult) {
    assert(cacheKey.platform === build.platform, "Cache key platform must match build platform");
    const stringifiedCacheKey = stringifyCacheKey(cacheKey);
    Logger.info(
      "Storing build in cache",
      build,
      "fingerprint:",
      buildFingerprint,
      "cacheKey:",
      stringifiedCacheKey
    );
    await extensionContext.globalState.update(stringifiedCacheKey, {
      fingerprint: buildFingerprint,
      buildResult: build,
    });
  }

  public async clearCache(cacheKey: CacheKey) {
    await extensionContext.globalState.update(stringifyCacheKey(cacheKey), undefined);
  }

  public async getBuild(currentFingerprint: string, cacheKey: CacheKey) {
    const cache = extensionContext.globalState.get<BuildCacheInfo>(stringifyCacheKey(cacheKey));
    if (!cache) {
      Logger.debug("No cached build found.");
      return undefined;
    }

    const fingerprintsMatch = cache.fingerprint === currentFingerprint;
    if (!fingerprintsMatch) {
      Logger.info(
        `Fingerprint mismatch, cannot use cached build. Old: '${cache.fingerprint}', new: '${currentFingerprint}'.`
      );
      return undefined;
    }

    const build = cache.buildResult;
    const appPath = build.platform === DevicePlatform.Android ? build.apkPath : build.appPath;
    try {
      const builtAppExists = fs.existsSync(appPath);
      if (!builtAppExists) {
        Logger.info("Couldn't use cached build. App artifact not found.");
        return undefined;
      }

      const appHash = await calculateAppHash(appPath);
      const hashesMatch = appHash === build.buildHash;
      if (hashesMatch) {
        Logger.info("Using cached build.");
        return build;
      }
    } catch (e) {
      // we only log the error and ignore it to allow new build to start
      Logger.error("Error while attempting to load cached build: ", e);
      return undefined;
    }
  }

  public async calculateFingerprint(options: FingerprintOptions) {
    return this.fingerprintProvider.calculateFingerprint(options);
  }

  public async isCacheStale(currentFingerprint: string, cacheKey: CacheKey) {
    const { fingerprint } =
      extensionContext.globalState.get<BuildCacheInfo>(stringifyCacheKey(cacheKey)) ?? {};

    return currentFingerprint !== fingerprint;
  }

  public hasCachedBuild(cacheKey: CacheKey) {
    return !!extensionContext.globalState.get<BuildCacheInfo>(stringifyCacheKey(cacheKey));
  }
}

export async function migrateOldBuildCachesToNewStorage(appRoot: string) {
  try {
    for (const platform of [DevicePlatform.Android, DevicePlatform.IOS]) {
      const oldKey =
        platform === DevicePlatform.Android ? ANDROID_BUILD_CACHE_KEY : IOS_BUILD_CACHE_KEY;
      const cache = extensionContext.workspaceState.get<BuildCacheInfo>(oldKey);
      if (cache) {
        await extensionContext.globalState.update(
          stringifyCacheKey({
            platform,
            appRoot,
            env: {},
          }),
          cache
        );
        await extensionContext.workspaceState.update(oldKey, undefined);
      }
    }
  } catch (e) {
    // we ignore all potential errors in this phase as it isn't critical and it is
    // better to not block the extension from starting in case of any issues when
    // migrating the caches
  }
}
