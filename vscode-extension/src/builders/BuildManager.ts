import { Logger } from "../Logger";
import { generateWorkspaceFingerprint } from "../utilities/fingerprint";
import { buildAndroid } from "./buildAndroid";
import { buildIos } from "./buildIOS";
import fs from "fs";
import { calculateMD5, getWorkspacePath } from "../utilities/common";
import { Platform } from "../common/DeviceManager";
import { extensionContext } from "../utilities/extensionContext";

const ANDROID_BUILD_CACHE_KEY = "android_build_cache";
const IOS_BUILD_CACHE_KEY = "ios_build_cache";

export type IOSBuildResult = {
  platform: Platform.IOS;
  appPath: string;
  bundleID: string;
};

export type AndroidBuildResult = {
  platform: Platform.Android;
  apkPath: string;
  packageName: string;
};

export type BuildResult = IOSBuildResult | AndroidBuildResult;

type AndroidBuildCacheInfo = {
  fingerprint: string;
  buildHash: string;
  buildResult: AndroidBuildResult;
};

type IOSBuildCacheInfo = {
  fingerprint: string;
  buildHash: string;
  buildResult: IOSBuildResult;
};

export class BuildManager {
  private iOSBuild: Promise<IOSBuildResult> | undefined;
  private androidBuild: Promise<AndroidBuildResult> | undefined;

  constructor() {}

  public getAndroidBuild() {
    return this.androidBuild;
  }

  public getBuild(platform: Platform) {
    if (platform === Platform.Android) {
      const build = this.getAndroidBuild();
      if (!build) {
        throw new Error("Android build not started");
      }
      return build;
    } else {
      const build = this.getIosBuild();
      if (!build) {
        throw new Error("iOS build not started");
      }
      return build;
    }
  }

  public getIosBuild() {
    return this.iOSBuild;
  }

  private async loadAndroidCachedBuild(newFingerprint: string) {
    try {
      const cacheInfo = extensionContext.workspaceState.get(
        ANDROID_BUILD_CACHE_KEY
      ) as AndroidBuildCacheInfo;

      if (cacheInfo && cacheInfo.fingerprint == newFingerprint) {
        const build = cacheInfo.buildResult;

        // We have to check if the user removed the build that was cached.
        if (fs.existsSync(build.apkPath)) {
          const hash = (await calculateMD5(build.apkPath)).digest("hex");

          if (hash === cacheInfo.buildHash) {
            Logger.log("Cache hit on android build. Using existing build.");
            return build;
          }
        }
      }
    } catch (e) {
      // we only log the error and ignore it to allow new build to start
      Logger.error("Error while attempting to load cached build", e);
    }
    return undefined;
  }

  private async startAndroidBuild(
    newFingerprintPromise: Promise<string>,
    forceCleanBuild: boolean
  ) {
    const newFingerprint = await newFingerprintPromise;
    if (!forceCleanBuild) {
      const buildResult = await this.loadAndroidCachedBuild(newFingerprint);
      if (buildResult) {
        return buildResult;
      }
    }

    const build = await buildAndroid(getWorkspacePath());
    const buildResult: AndroidBuildResult = { ...build, platform: Platform.Android };

    // store build info in the cache
    const newBuildHash = (await calculateMD5(build.apkPath)).digest("hex");
    const buildInfo = { fingerprint: newFingerprint, buildHash: newBuildHash, buildResult };
    extensionContext.workspaceState.update(ANDROID_BUILD_CACHE_KEY, buildInfo);

    return buildResult;
  }

  private async loadIOSCachedBuild(newFingerprint: string) {
    try {
      const cacheInfo = extensionContext.workspaceState.get(
        IOS_BUILD_CACHE_KEY
      ) as IOSBuildCacheInfo;

      if (cacheInfo && cacheInfo.fingerprint == newFingerprint) {
        const build = cacheInfo.buildResult;

        // We have to check if the user removed the build that was cached.
        if (fs.existsSync(build.appPath)) {
          const hash = (await calculateMD5(build.appPath)).digest("hex");

          if (hash === cacheInfo.buildHash) {
            Logger.log("Cache hit on iOS build. Using existing build.");
            return build;
          }
        }
      }
    } catch (e) {
      // we only log the error and ignore it to allow new build to start
      Logger.error("Error while attempting to load cached build", e);
    }
    return undefined;
  }

  private async startIOSBuild(newFingerprintPromise: Promise<string>, forceCleanBuild: boolean) {
    const newFingerprint = await newFingerprintPromise;
    if (!forceCleanBuild) {
      const buildResult = await this.loadIOSCachedBuild(newFingerprint);
      if (buildResult) {
        return buildResult;
      }
    }

    const build = await buildIos(getWorkspacePath());
    const buildResult: IOSBuildResult = { ...build, platform: Platform.IOS };

    // store build info in the cache
    const newBuildHash = (await calculateMD5(build.appPath)).digest("hex");
    const buildInfo = { fingerprint: newFingerprint, buildHash: newBuildHash, buildResult };
    extensionContext.workspaceState.update(IOS_BUILD_CACHE_KEY, buildInfo);

    return { ...build, platform: Platform.IOS } as IOSBuildResult;
  }

  public startBuilding(forceCleanBuild: boolean) {
    const newFingerprintHash = generateWorkspaceFingerprint();
    Logger.debug("Start build", forceCleanBuild ? "(force clean build)" : "(using build cache)");
    this.iOSBuild = this.startIOSBuild(newFingerprintHash, forceCleanBuild);
    this.androidBuild = this.startAndroidBuild(newFingerprintHash, forceCleanBuild);
  }
}
