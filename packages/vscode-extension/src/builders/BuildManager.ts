import { Logger } from "../Logger";
import { generateWorkspaceFingerprint } from "../utilities/fingerprint";
import { AndroidBuildResult, buildAndroid } from "./buildAndroid";
import { IOSBuildResult, buildIos } from "./buildIOS";
import fs from "fs";
import { calculateMD5 } from "../utilities/common";
import { DeviceInfo, DevicePlatform } from "../common/DeviceManager";
import { extensionContext, getAppRootFolder } from "../utilities/extensionContext";
import { Disposable, OutputChannel, window } from "vscode";
import { DependencyManager } from "../dependency/DependencyManager";
import { CancelToken } from "./cancelToken";

const ANDROID_BUILD_CACHE_KEY = "android_build_cache";
const IOS_BUILD_CACHE_KEY = "ios_build_cache";

export type BuildResult = IOSBuildResult | AndroidBuildResult;

type BuildCacheInfo = {
  fingerprint: string;
  buildHash: string;
  buildResult: AndroidBuildResult | IOSBuildResult;
};

export interface DisposableBuild<R> extends Disposable {
  readonly build: Promise<R>;
}

type BuildOptions = {
  clean: boolean;
  progressListener: (newProgress: number) => void;
  onSuccess: () => void;
};

export class BuildManager {
  constructor(private readonly dependencyManager: DependencyManager) {}

  private buildOutputChannel: OutputChannel | undefined;

  public focusBuildOutput() {
    this.buildOutputChannel?.show();
  }

  public startBuild(deviceInfo: DeviceInfo, options: BuildOptions): DisposableBuild<BuildResult> {
    const { clean: forceCleanBuild, progressListener, onSuccess } = options;
    const { platform } = deviceInfo;
    const cancelToken = new CancelToken();

    const buildApp = async () => {
      const newFingerprint = await generateWorkspaceFingerprint();
      const cacheKey =
        platform === DevicePlatform.Android ? ANDROID_BUILD_CACHE_KEY : IOS_BUILD_CACHE_KEY;
      if (forceCleanBuild) {
        // we reset the cache when force clean build is requested as the newly started build may end up being cancelled
        await extensionContext.workspaceState.update(cacheKey, undefined);
      } else {
        const cachedBuild = await loadCachedBuild(cacheKey, newFingerprint);
        if (cachedBuild) {
          return cachedBuild;
        }
      }

      let buildResult: BuildResult;
      if (platform === DevicePlatform.Android) {
        this.buildOutputChannel = window.createOutputChannel("React Native IDE (Android build)", {
          log: true,
        });
        buildResult = await buildAndroid(
          getAppRootFolder(),
          forceCleanBuild,
          cancelToken,
          this.buildOutputChannel,
          progressListener
        );
      } else {
        this.buildOutputChannel = window.createOutputChannel("React Native IDE (iOS build)", {
          log: true,
        });
        buildResult = await buildIos(
          deviceInfo,
          getAppRootFolder(),
          forceCleanBuild,
          cancelToken,
          this.buildOutputChannel,
          progressListener,
          () => {
            return this.dependencyManager.checkPodsInstalled();
          },
          (appRootFolder: string, cleanBuild: boolean, token: CancelToken) => {
            return this.dependencyManager.installPods(appRootFolder, cleanBuild, token);
          }
        );
      }

      await extensionContext.workspaceState.update(cacheKey, {
        fingerprint: newFingerprint,
        buildHash: await getAppHash(getAppPath(buildResult)),
        buildResult,
      });

      return buildResult;
    };

    const disposableBuild = {
      build: buildApp(),
      dispose: () => {
        cancelToken.cancel();
      },
    };
    disposableBuild.build.then(onSuccess);

    return disposableBuild;
  }
}

async function loadCachedBuild(
  cacheKey: typeof ANDROID_BUILD_CACHE_KEY | typeof IOS_BUILD_CACHE_KEY,
  newFingerprint: string
) {
  const cacheInfo = extensionContext.workspaceState.get<BuildCacheInfo>(cacheKey);
  const fingerprintsMatch = cacheInfo?.fingerprint === newFingerprint;
  if (!fingerprintsMatch) {
    return undefined;
  }

  const build = cacheInfo.buildResult;
  const appPath = getAppPath(build);
  try {
    const builtAppExists = fs.existsSync(appPath);
    if (!builtAppExists) {
      return undefined;
    }

    const hash = await getAppHash(appPath);
    const hashesMatch = hash === cacheInfo.buildHash;
    if (hashesMatch) {
      Logger.log("Using existing build.");
      return build;
    }
  } catch (e) {
    // we only log the error and ignore it to allow new build to start
    Logger.error("Error while attempting to load cached build", e);
    return undefined;
  }
}

export async function didFingerprintChange(platform: DevicePlatform) {
  const newFingerprint = await generateWorkspaceFingerprint();

  if (platform === DevicePlatform.IOS) {
    const { fingerprint: iosFingerprint } =
      extensionContext.workspaceState.get<BuildCacheInfo>(IOS_BUILD_CACHE_KEY) ?? {};
    return newFingerprint !== iosFingerprint;
  }

  const { fingerprint: androidFingerprint } =
    extensionContext.workspaceState.get<BuildCacheInfo>(ANDROID_BUILD_CACHE_KEY) ?? {};
  return newFingerprint !== androidFingerprint;
}

async function getAppHash(appPath: string) {
  return (await calculateMD5(appPath)).digest("hex");
}

function getAppPath(build: BuildResult) {
  return build.platform === DevicePlatform.Android ? build.apkPath : build.appPath;
}
