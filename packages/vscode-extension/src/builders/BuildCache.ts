import fs from "fs";
import crypto from "crypto";
import stableStringify from "fast-json-stable-stringify";
import { Logger } from "../Logger";
import { extensionContext } from "../utilities/extensionContext";
import { IOSBuildResult } from "./buildIOS";
import { AndroidBuildResult } from "./buildAndroid";
import { calculateAppHash } from "../utilities/common";
import { BuildResult } from "./BuildManager";
import { FingerprintProvider } from "../project/FingerprintProvider";
import { DevicePlatform } from "../common/State";
import { BuildConfig } from "../common/BuildConfig";

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

function buildCacheKey(buildConfig: BuildConfig) {
  const keyPrefix =
    buildConfig.platform === DevicePlatform.Android ? ANDROID_BUILD_CACHE_KEY : IOS_BUILD_CACHE_KEY;

  const buildConfigHash = crypto.createHash("md5");
  buildConfigHash.update(stableStringify(buildConfig));
  const hash = buildConfigHash.digest("hex");

  return `${keyPrefix}:${hash}`;
}

export class BuildCache {
  constructor(private readonly fingerprintProvider: FingerprintProvider) {}

  /**
   * Passed fingerprint should be calculated at the time build is started.
   */
  public async storeBuild(buildFingerprint: string, buildConfig: BuildConfig, build: BuildResult) {
    await extensionContext.globalState.update(buildCacheKey(buildConfig), {
      fingerprint: buildFingerprint,
      buildResult: build,
    });
  }

  public async clearCache(cacheKey: BuildConfig) {
    await extensionContext.globalState.update(buildCacheKey(cacheKey), undefined);
  }

  public async getBuild(currentFingerprint: string, buildConfig: BuildConfig) {
    const cache = extensionContext.globalState.get<BuildCacheInfo>(buildCacheKey(buildConfig));
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

  public async calculateFingerprint(buildConfig: BuildConfig) {
    return this.fingerprintProvider.calculateFingerprint(buildConfig);
  }

  public async isCacheStale(buildConfig: BuildConfig) {
    const currentFingerprint = await this.calculateFingerprint(buildConfig);
    const { fingerprint } =
      extensionContext.globalState.get<BuildCacheInfo>(buildCacheKey(buildConfig)) ?? {};

    return currentFingerprint !== fingerprint;
  }

  public hasCachedBuild(buildConfig: BuildConfig) {
    return !!extensionContext.globalState.get<BuildCacheInfo>(buildCacheKey(buildConfig));
  }
}
