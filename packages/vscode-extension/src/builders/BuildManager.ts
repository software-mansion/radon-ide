import { Logger } from "../Logger";
import { generateWorkspaceFingerprint } from "../utilities/fingerprint";
import { buildAndroid } from "./buildAndroid";
import { buildIos } from "./buildIOS";
import fs from "fs";
import { calculateMD5 } from "../utilities/common";
import { DeviceInfo, IOSDeviceInfo, IOSRuntimeInfo, Platform } from "../common/DeviceManager";
import { extensionContext, getAppRootFolder } from "../utilities/extensionContext";
import { exec } from "../utilities/subprocess";
import { Disposable, OutputChannel, window } from "vscode";
import { downloadExpoGo, isExpoGoProject } from "./expoGo";

const ANDROID_BUILD_CACHE_KEY = "android_build_cache";
const IOS_BUILD_CACHE_KEY = "ios_build_cache";

export const EXPO_GO_BUNDLE_ID = "host.exp.Exponent";
export const EXPO_GO_PACKAGE_NAME = "host.exp.exponent";

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

export async function didFingerprintChange(platform: Platform) {
  const newFingerprint = await generateWorkspaceFingerprint();
  if (platform === Platform.IOS) {
    const { fingerprint: iosFingerprint } =
      extensionContext.workspaceState.get<IOSBuildCacheInfo>(IOS_BUILD_CACHE_KEY) ?? {};
    return newFingerprint !== iosFingerprint;
  }

  const { fingerprint: androidFingerprint } =
    extensionContext.workspaceState.get<AndroidBuildCacheInfo>(ANDROID_BUILD_CACHE_KEY) ?? {};
  return newFingerprint !== androidFingerprint;
}

export class CancelToken {
  private _cancelled = false;
  private cancelListeners: (() => void)[] = [];

  public onCancel(cb: () => void) {
    this.cancelListeners.push(cb);
  }

  public adapt(execResult: ReturnType<typeof exec>) {
    this.onCancel(() => execResult.kill(9));
    return execResult;
  }

  public cancel() {
    this._cancelled = true;
    for (const listener of this.cancelListeners) {
      listener();
    }
  }

  get cancelled() {
    return this._cancelled;
  }
}

export interface DisposableBuild<R> extends Disposable {
  readonly build: Promise<R>;
}

class DisposableBuildImpl<R> implements DisposableBuild<R> {
  constructor(public readonly build: Promise<R>, private readonly cancelToken: CancelToken) {}
  dispose() {
    this.cancelToken.cancel();
  }
}

export class BuildManager {
  private buildOutputChannel: OutputChannel | undefined;

  public focusBuildOutput() {
    this.buildOutputChannel?.show();
  }

  public startBuild(
    deviceInfo: DeviceInfo,
    forceCleanBuild: boolean,
    progressListener: (newProgress: number) => void
  ) {
    if (deviceInfo.platform === Platform.Android) {
      const cancelToken = new CancelToken();
      return new DisposableBuildImpl(
        this.startAndroidBuild(forceCleanBuild, cancelToken, progressListener),
        cancelToken
      );
    } else {
      const cancelToken = new CancelToken();
      return new DisposableBuildImpl(
        this.startIOSBuild(deviceInfo, forceCleanBuild, cancelToken, progressListener),
        cancelToken
      );
    }
  }

  private async loadAndroidCachedBuild(newFingerprint: string) {
    try {
      const cacheInfo =
        extensionContext.workspaceState.get<AndroidBuildCacheInfo>(ANDROID_BUILD_CACHE_KEY);

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
    forceCleanBuild: boolean,
    cancelToken: CancelToken,
    progressListener: (newProgress: number) => void
  ) {
    if (await isExpoGoProject()) {
      const apkPath = await downloadExpoGo(Platform.Android, cancelToken);
      return {
        platform: Platform.Android,
        apkPath,
        packageName: EXPO_GO_PACKAGE_NAME,
      } as AndroidBuildResult;
    }

    const newFingerprint = await generateWorkspaceFingerprint();
    if (!forceCleanBuild) {
      const buildResult = await this.loadAndroidCachedBuild(newFingerprint);
      if (buildResult) {
        return buildResult;
      }
    } else {
      // we reset the cache when force clean build is requested as the newly started build may end up being cancelled
      extensionContext.workspaceState.update(ANDROID_BUILD_CACHE_KEY, undefined);
    }

    this.buildOutputChannel = window.createOutputChannel(`React Native IDE (Android build)`, {
      log: true,
    });

    const build = await buildAndroid(
      getAppRootFolder(),
      forceCleanBuild,
      cancelToken,
      this.buildOutputChannel!,
      progressListener
    );
    const buildResult: AndroidBuildResult = {
      ...build,
      platform: Platform.Android,
    };

    // store build info in the cache
    const newBuildHash = (await calculateMD5(build.apkPath)).digest("hex");
    const buildInfo = { fingerprint: newFingerprint, buildHash: newBuildHash, buildResult };
    extensionContext.workspaceState.update(ANDROID_BUILD_CACHE_KEY, buildInfo);

    return buildResult;
  }

  private async loadIOSCachedBuild(newFingerprint: string) {
    try {
      const cacheInfo = extensionContext.workspaceState.get<IOSBuildCacheInfo>(IOS_BUILD_CACHE_KEY);

      if (cacheInfo && cacheInfo.fingerprint === newFingerprint) {
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

  private async startIOSBuild(
    deviceInfo: IOSDeviceInfo,
    forceCleanBuild: boolean,
    cancelToken: CancelToken,
    progressListener: (newProgress: number) => void
  ): Promise<IOSBuildResult> {
    if (await isExpoGoProject()) {
      const appPath = await downloadExpoGo(Platform.IOS, cancelToken);
      return { platform: Platform.IOS, appPath, bundleID: EXPO_GO_BUNDLE_ID };
    }
    const newFingerprint = await generateWorkspaceFingerprint();
    if (!forceCleanBuild) {
      const buildResult = await this.loadIOSCachedBuild(newFingerprint);
      if (buildResult) {
        return buildResult;
      }
    } else {
      // we reset the cache when force clean build is requested as the newly started build may end up being cancelled
      extensionContext.workspaceState.update(IOS_BUILD_CACHE_KEY, undefined);
    }

    this.buildOutputChannel = window.createOutputChannel("React Native IDE (iOS build)", {
      log: true,
    });

    const build = await buildIos(
      deviceInfo,
      getAppRootFolder(),
      forceCleanBuild,
      cancelToken,
      this.buildOutputChannel!,
      progressListener
    );
    const buildResult = { ...build, platform: Platform.IOS };

    // store build info in the cache
    const newBuildHash = (await calculateMD5(build.appPath)).digest("hex");
    const buildInfo = { fingerprint: newFingerprint, buildHash: newBuildHash, buildResult };
    extensionContext.workspaceState.update(IOS_BUILD_CACHE_KEY, buildInfo);

    return { ...build, platform: Platform.IOS };
  }
}
