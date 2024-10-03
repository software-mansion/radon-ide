import { Disposable, OutputChannel, window } from "vscode";
import { Logger } from "../Logger";
import { PlatformBuildCache } from "./PlatformBuildCache";
import { AndroidBuildResult, buildAndroid } from "./buildAndroid";
import { IOSBuildResult, buildIos } from "./buildIOS";
import { DeviceInfo, DevicePlatform } from "../common/DeviceManager";
import { getAppRootFolder } from "../utilities/extensionContext";
import { DependencyManager } from "../dependency/DependencyManager";
import { CancelToken } from "./cancelToken";

export type BuildResult = IOSBuildResult | AndroidBuildResult;

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
    const buildCache = new PlatformBuildCache(platform, cancelToken);

    const buildApp = async () => {
      if (!forceCleanBuild) {
        const cachedBuild = await buildCache.getBuild();
        if (cachedBuild) {
          return cachedBuild;
        }
      }

      // we reset the cache when force clean build is requested as the newly
      // started build may end up being cancelled
      await buildCache.clearCache();

      let buildResult: BuildResult;
      if (platform === DevicePlatform.Android) {
        this.buildOutputChannel = window.createOutputChannel("Radon IDE (Android build)", {
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
        this.buildOutputChannel = window.createOutputChannel("Radon IDE (iOS build)", {
          log: true,
        });
        const installPodsIfNeeded = async () => {
          const podsInstalled = await this.dependencyManager.isInstalled("pods");
          if (!podsInstalled) {
            Logger.info("Pods installation is missing or outdated. Installing Pods.");
            await this.dependencyManager.installPods(cancelToken);
          }
        };
        buildResult = await buildIos(
          deviceInfo,
          getAppRootFolder(),
          forceCleanBuild,
          cancelToken,
          this.buildOutputChannel,
          progressListener,
          installPodsIfNeeded
        );
      }

      await buildCache.storeBuild(buildResult);

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
