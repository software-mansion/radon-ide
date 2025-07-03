import fs from "fs";
import { Logger } from "../Logger";
import { extensionContext } from "../utilities/extensionContext";
import { DevicePlatform } from "../common/DeviceManager";
import { IOSBuildResult } from "./buildIOS";
import { AndroidBuildResult } from "./buildAndroid";
import { calculateMD5 } from "../utilities/common";
import { BuildResult } from "./BuildManager";
import { FingerprintOptions, FingerprintProvider } from "../project/FingerprintProvider";

const ANDROID_BUILD_CACHE_KEY = "android_build_cache";
const IOS_BUILD_CACHE_KEY = "ios_build_cache";

export type BuildCacheInfo = {
  fingerprint: string;
  buildHash: string;
  buildResult: AndroidBuildResult | IOSBuildResult;
};

function makeCacheKey(platform: DevicePlatform, appRoot: string) {
  const keyPrefix =
    platform === DevicePlatform.Android ? ANDROID_BUILD_CACHE_KEY : IOS_BUILD_CACHE_KEY;
  return `${keyPrefix}:${appRoot}`;
}

export class BuildCache {
  constructor(private readonly fingerprintProvider: FingerprintProvider) {}

  /**
   * Passed fingerprint should be calculated at the time build is started.
   */
  public async storeBuild(buildFingerprint: string, appRootFolder: string, build: BuildResult) {
    const appPath = await getAppHash(getAppPath(build));
    await extensionContext.globalState.update(makeCacheKey(build.platform, appRootFolder), {
      fingerprint: buildFingerprint,
      buildHash: appPath,
      buildResult: build,
    });
  }

  public async clearCache(platform: DevicePlatform, appRootFolder: string) {
    await extensionContext.globalState.update(makeCacheKey(platform, appRootFolder), undefined);
  }

  public async getBuild(
    currentFingerprint: string,
    platform: DevicePlatform,
    appRootFolder: string
  ) {
    const cache = extensionContext.globalState.get<BuildCacheInfo>(
      makeCacheKey(platform, appRootFolder)
    );
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
    const appPath = getAppPath(build);
    try {
      const builtAppExists = fs.existsSync(appPath);
      if (!builtAppExists) {
        Logger.info("Couldn't use cached build. App artifact not found.");
        return undefined;
      }

      const appHash = await getAppHash(appPath);
      const hashesMatch = appHash === cache.buildHash;
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

  public async isCacheStale(
    currentFingerprint: string,
    platform: DevicePlatform,
    appRootFolder: string
  ) {
    const { fingerprint } =
      extensionContext.globalState.get<BuildCacheInfo>(makeCacheKey(platform, appRootFolder)) ?? {};

    return currentFingerprint !== fingerprint;
  }

  public hasCachedBuild(platform: DevicePlatform, appRootFolder: string) {
    return !!extensionContext.globalState.get<BuildCacheInfo>(
      makeCacheKey(platform, appRootFolder)
    );
  }
}

function getAppPath(build: BuildResult) {
  return build.platform === DevicePlatform.Android ? build.apkPath : build.appPath;
}

async function getAppHash(appPath: string) {
  return (await calculateMD5(appPath)).digest("hex");
}

export async function migrateOldBuildCachesToNewStorage(appRoot: string) {
  try {
    for (const platform of [DevicePlatform.Android, DevicePlatform.IOS]) {
      const oldKey =
        platform === DevicePlatform.Android ? ANDROID_BUILD_CACHE_KEY : IOS_BUILD_CACHE_KEY;
      const cache = extensionContext.workspaceState.get<BuildCacheInfo>(oldKey);
      if (cache) {
        await extensionContext.globalState.update(makeCacheKey(platform, appRoot), cache);
        await extensionContext.workspaceState.update(oldKey, undefined);
      }
    }
  } catch (e) {
    // we ignore all potential errors in this phase as it isn't critical and it is
    // better to not block the extension from starting in case of any issues when
    // migrating the caches
  }
}
