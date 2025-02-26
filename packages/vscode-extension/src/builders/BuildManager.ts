import { Disposable, OutputChannel, window } from "vscode";
import { BuildCache } from "./BuildCache";
import { AndroidBuildResult, buildAndroid } from "./buildAndroid";
import { IOSBuildResult, buildIos } from "./buildIOS";
import { DeviceInfo, DevicePlatform } from "../common/DeviceManager";
import { DependencyManager } from "../dependency/DependencyManager";
import { CancelToken } from "./cancelToken";
import { getTelemetryReporter } from "../utilities/telemetry";
import { Logger } from "../Logger";

export type BuildResult = IOSBuildResult | AndroidBuildResult;

export interface DisposableBuild<R> extends Disposable {
  readonly build: Promise<R>;
}

type BuildOptions = {
  appRoot: string;
  clean: boolean;
  progressListener: (newProgress: number) => void;
  onSuccess: () => void;
};

export class BuildManager {
  constructor(
    private readonly dependencyManager: DependencyManager,
    private readonly buildCache: BuildCache
  ) {}

  private buildOutputChannel: OutputChannel | undefined;

  public focusBuildOutput() {
    this.buildOutputChannel?.show();
  }

  /**
   * Returns true if some native build dependencies have change and we should perform
   * a native build despite the fact the fingerprint indicates we don't need to.
   * This is currently only used for the scenario when we detect that pods need
   * to be reinstalled for iOS.
   */
  private async checkBuildDependenciesChanged(deviceInfo: DeviceInfo) {
    if (deviceInfo.platform === DevicePlatform.IOS) {
      return !(await this.dependencyManager.checkPodsInstallationStatus());
    }
    return false;
  }

  public startBuild(deviceInfo: DeviceInfo, options: BuildOptions): DisposableBuild<BuildResult> {
    const { clean: forceCleanBuild, progressListener, onSuccess, appRoot } = options;
    const { platform } = deviceInfo;

    getTelemetryReporter().sendTelemetryEvent("build:requested", {
      platform,
      type: forceCleanBuild ? "clean" : "incremental",
    });

    const cancelToken = new CancelToken();

    const buildApp = async () => {
      const currentFingerprint = await this.buildCache.calculateFingerprint(platform);

      // Native build dependencies when changed, should invalidate cached build (even if the fingerprint is the same)
      const buildDependenciesChanged = await this.checkBuildDependenciesChanged(deviceInfo);

      if (forceCleanBuild || buildDependenciesChanged) {
        // we reset the cache when force clean build is requested as the newly
        // started build may end up being cancelled
        Logger.debug(
          "Build cache is being invalidated",
          forceCleanBuild ? "on request" : "due to build dependencies change"
        );
        await this.buildCache.clearCache(platform);
      } else {
        const cachedBuild = await this.buildCache.getBuild(currentFingerprint, platform);
        if (cachedBuild) {
          Logger.debug("Skipping native build – using cached");
          getTelemetryReporter().sendTelemetryEvent("build:cache-hit", { platform });
          return cachedBuild;
        } else {
          Logger.debug("Build cache is stale");
        }
      }

      Logger.debug(
        "Starting native build – no build cached, cache has been invalidated or is stale"
      );
      getTelemetryReporter().sendTelemetryEvent("build:start", { platform });

      let buildResult: BuildResult;
      let buildFingerprint = currentFingerprint;
      if (platform === DevicePlatform.Android) {
        this.buildOutputChannel = window.createOutputChannel("Radon IDE (Android build)", {
          log: true,
        });
        this.buildOutputChannel.clear();
        buildResult = await buildAndroid(
          appRoot,
          forceCleanBuild,
          cancelToken,
          this.buildOutputChannel,
          progressListener,
          this.dependencyManager
        );
      } else {
        const iOSBuildOutputChannel = window.createOutputChannel("Radon IDE (iOS build)", {
          log: true,
        });
        this.buildOutputChannel = iOSBuildOutputChannel;
        this.buildOutputChannel.clear();
        const installPodsIfNeeded = async () => {
          let installPods = forceCleanBuild;
          if (installPods) {
            Logger.info("Clean build requested: installing pods");
          } else {
            const podsInstalled = await this.dependencyManager.checkPodsInstallationStatus();
            if (!podsInstalled) {
              Logger.info("Pods installation is missing or outdated. Installing Pods.");
              installPods = true;
            }
          }
          if (installPods) {
            getTelemetryReporter().sendTelemetryEvent("build:install-pods", { platform });
            await this.dependencyManager.installPods(iOSBuildOutputChannel, cancelToken);
            // Installing pods may impact the fingerprint as new pods may be created under the project directory.
            // For this reason we need to recalculate the fingerprint after installing pods.
            buildFingerprint = await this.buildCache.calculateFingerprint(platform);
          }
        };
        buildResult = await buildIos(
          appRoot,
          forceCleanBuild,
          cancelToken,
          this.buildOutputChannel,
          progressListener,
          this.dependencyManager,
          installPodsIfNeeded
        );
      }

      await this.buildCache.storeBuild(buildFingerprint, buildResult, platform);

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
