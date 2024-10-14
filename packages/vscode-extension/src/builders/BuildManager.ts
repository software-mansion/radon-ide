import { Disposable, OutputChannel, window } from "vscode";
import { Logger } from "../Logger";
import { PlatformBuildCache } from "./PlatformBuildCache";
import { AndroidBuildResult, buildAndroid } from "./buildAndroid";
import { IOSBuildResult, buildIos } from "./buildIOS";
import { DeviceInfo, DevicePlatform } from "../common/DeviceManager";
import { getAppRootFolder } from "../utilities/extensionContext";
import { DependencyManager } from "../dependency/DependencyManager";
import { CancelToken } from "./cancelToken";
import { getTelemetryReporter } from "../utilities/telemetry";

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

    getTelemetryReporter().sendTelemetryEvent("build:requested", {
      platform,
      type: forceCleanBuild ? "clean" : "incremental",
    });

    const cancelToken = new CancelToken();
    const buildCache = PlatformBuildCache.forPlatform(platform);

    const buildApp = async () => {
      const currentFingerprint = await buildCache.calculateFingerprint();

      // If pods are required to be installed, we ignore the cached build, we don't want clean build in this case though
      const buildDependenciesChanged =
        !(await this.dependencyManager.checkPodsInstallationStatus());

      if (forceCleanBuild || buildDependenciesChanged) {
        // we reset the cache when force clean build is requested as the newly
        // started build may end up being cancelled
        await buildCache.clearCache();
      } else {
        const cachedBuild = await buildCache.getBuild(currentFingerprint);
        if (cachedBuild) {
          getTelemetryReporter().sendTelemetryEvent("build:cache-hit", { platform });
          return cachedBuild;
        }
      }

      getTelemetryReporter().sendTelemetryEvent("build:start", { platform });

      let buildResult: BuildResult;
      let buildFingerprint = currentFingerprint;
      if (platform === DevicePlatform.Android) {
        this.buildOutputChannel = window.createOutputChannel("Radon IDE (Android build)", {
          log: true,
        });
        buildResult = await buildAndroid(
          getAppRootFolder(),
          forceCleanBuild,
          cancelToken,
          this.buildOutputChannel,
          progressListener,
          this.dependencyManager
        );
      } else {
        this.buildOutputChannel = window.createOutputChannel("Radon IDE (iOS build)", {
          log: true,
        });
        const installPodsIfNeeded = async () => {
          const podsInstalled = await this.dependencyManager.checkPodsInstallationStatus();
          if (!podsInstalled) {
            Logger.info("Pods installation is missing or outdated. Installing Pods.");
            getTelemetryReporter().sendTelemetryEvent("build:install-pods", { platform });
            await this.dependencyManager.installPods(cancelToken);
            // Installing pods may impact the fingerprint as new pods may be created under the project directory.
            // For this reason we need to recalculate the fingerprint after installing pods.
            buildFingerprint = await buildCache.calculateFingerprint();
          }
        };
        buildResult = await buildIos(
          deviceInfo,
          getAppRootFolder(),
          forceCleanBuild,
          cancelToken,
          this.buildOutputChannel,
          progressListener,
          this.dependencyManager,
          installPodsIfNeeded
        );
      }

      await buildCache.storeBuild(buildFingerprint, buildResult);

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
