import path from "path";
import fs from "fs";
import { createFingerprintAsync } from "@expo/fingerprint";
import { Logger } from "../Logger";
import { extensionContext, getAppRootFolder } from "../utilities/extensionContext";
import { DevicePlatform } from "../common/DeviceManager";
import { IOSBuildResult } from "./buildIOS";
import { AndroidBuildResult } from "./buildAndroid";
import { getLaunchConfiguration } from "../utilities/launchConfiguration";
import { runFingerprintScript } from "./customBuild";
import { CancelToken } from "./cancelToken";
import { calculateMD5 } from "../utilities/common";
import { BuildResult } from "./BuildManager";

const ANDROID_BUILD_CACHE_KEY = "android_build_cache";
const IOS_BUILD_CACHE_KEY = "ios_build_cache";

const IGNORE_PATHS = [
  path.join("android", ".gradle/**/*"),
  path.join("android", "build/**/*"),
  path.join("android", "app", "build/**/*"),
  path.join("ios", "build/**/*"),
  "**/node_modules/**/android/.cxx/**/*",
  "**/node_modules/**/.gradle/**/*",
  "**/node_modules/**/android/build/intermediates/cxx/**/*",
];

export type BuildCacheInfo = {
  fingerprint: string;
  buildHash: string;
  buildResult: AndroidBuildResult | IOSBuildResult;
};

export class PlatformBuildCache {
  private cacheKey: string;

  constructor(
    private readonly platform: DevicePlatform,
    private readonly cancelToken: CancelToken
  ) {
    this.cacheKey =
      platform === DevicePlatform.Android ? ANDROID_BUILD_CACHE_KEY : IOS_BUILD_CACHE_KEY;
  }

  public async storeBuild(build: BuildResult) {
    const fingerprint = await this.calculateFingerprint();
    const appPath = await getAppHash(getAppPath(build));
    await extensionContext.workspaceState.update(this.cacheKey, {
      fingerprint,
      buildHash: appPath,
      buildResult: build,
    });
  }

  public async clearCache() {
    await extensionContext.workspaceState.update(this.cacheKey, undefined);
  }

  public async getBuild() {
    const cache = extensionContext.workspaceState.get<BuildCacheInfo>(this.cacheKey);
    if (!cache) {
      Logger.debug("No cached build found.");
      return undefined;
    }

    const currentFingerprint = await this.calculateFingerprint();
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

  public async isCacheInvalidated() {
    const currentFingerprint = await this.calculateFingerprint();
    const { fingerprint } =
      extensionContext.workspaceState.get<BuildCacheInfo>(this.cacheKey) ?? {};

    return currentFingerprint !== fingerprint;
  }

  private async calculateFingerprint() {
    const customFingerprint = await this.calculateCustomFingerprint();

    if (customFingerprint) {
      return customFingerprint;
    }

    const fingerprint = await createFingerprintAsync(getAppRootFolder(), {
      ignorePaths: IGNORE_PATHS,
    });
    Logger.log(`Workspace fingerprint: '${fingerprint.hash}'`);
    return fingerprint.hash;
  }

  private async calculateCustomFingerprint() {
    const { customBuild, env } = getLaunchConfiguration();
    const configPlatform = (
      {
        [DevicePlatform.Android]: "android",
        [DevicePlatform.IOS]: "ios",
      } as const
    )[this.platform];
    const fingerprintScript = customBuild?.[configPlatform]?.fingerprintScript;

    if (!fingerprintScript) {
      return undefined;
    }

    Logger.log(`Using custom fingerprint script '${fingerprintScript}'`);
    let { lastLine: hash } =
      (await runFingerprintScript(this.cancelToken, fingerprintScript, env)) ?? {};

    if (!hash) {
      throw new Error("Failed to generate workspace fingerprint using custom script.");
    }

    Logger.log("Workspace fingerprint", hash);
    return hash;
  }
}

function getAppPath(build: BuildResult) {
  return build.platform === DevicePlatform.Android ? build.apkPath : build.appPath;
}

async function getAppHash(appPath: string) {
  return (await calculateMD5(appPath)).digest("hex");
}
