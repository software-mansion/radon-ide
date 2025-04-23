import { Disposable, OutputChannel, window } from "vscode";
import _ from "lodash";
import { BuildCache } from "./BuildCache";
import { AndroidBuildResult, buildAndroid } from "./buildAndroid";
import { IOSBuildResult, buildIos } from "./buildIOS";
import { DeviceInfo, DevicePlatform } from "../common/DeviceManager";
import { DependencyManager } from "../dependency/DependencyManager";
import { CancelError, CancelToken } from "./cancelToken";
import { getTelemetryReporter } from "../utilities/telemetry";
import { Logger } from "../Logger";
import { BuildConfig, BuildType } from "../common/BuildConfig";
import { getLaunchConfiguration } from "../utilities/launchConfiguration";
import { isExpoGoProject } from "./expoGo";
import { LaunchConfigurationOptions } from "../common/LaunchConfig";
import { throttleAsync } from "../utilities/throttle";
import { watchProjectFiles } from "../utilities/watchProjectFiles";

const FINGERPRINT_THROTTLE_MS = 10 * 1000; // 10 seconds

export type BuildResult = IOSBuildResult | AndroidBuildResult;

export interface DisposableBuild<R> extends Disposable {
  readonly build: Promise<R>;
}

export interface BuildManagerDelegate {
  onCacheStale: (platform: DevicePlatform) => void;
}

type BuildOptions = {
  appRoot: string;
  clean: boolean;
  progressListener: (newProgress: number) => void;
  cancelToken: CancelToken;
};

export class BuildError extends Error {
  constructor(
    message: string,
    public readonly buildType: BuildType | null
  ) {
    super(message);
  }
}

class WorkspaceChangeListener implements Disposable {
  private watcher: Disposable | undefined;

  constructor(private readonly onChange: () => void) {}

  public startWatching() {
    if (this.watcher === undefined) {
      this.watcher = watchProjectFiles(() => {
        this.onChange();
      });
    }
  }

  public stopWatching() {
    this.watcher?.dispose();
    this.watcher = undefined;
  }

  public dispose() {
    this.watcher?.dispose();
  }
}

export class BuildManager implements Disposable {
  private isCachedBuildStale: boolean;

  private workspaceChangeListener: WorkspaceChangeListener;

  constructor(
    private readonly dependencyManager: DependencyManager,
    private readonly buildCache: BuildCache,
    private readonly buildManagerDelegate: BuildManagerDelegate,
    private readonly platform: DevicePlatform
  ) {
    this.isCachedBuildStale = false;
    // Note: in future implementations decoupled from device session we
    // should make this logic platform independent
    this.workspaceChangeListener = new WorkspaceChangeListener(() => {
      this.checkIfNativeChangedForPlatform();
    });
    this.workspaceChangeListener.startWatching();
  }

  public shouldRebuild() {
    return this.isCachedBuildStale;
  }

  public activate() {
    this.workspaceChangeListener.startWatching();
  }

  public deactivate() {
    this.workspaceChangeListener.stopWatching();
  }

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

  private async inferBuildType(
    appRoot: string,
    platform: DevicePlatform,
    launchConfiguration: LaunchConfigurationOptions
  ): Promise<BuildType> {
    const { customBuild, eas } = launchConfiguration;
    const platformMapping = {
      [DevicePlatform.Android]: "android",
      [DevicePlatform.IOS]: "ios",
    } as const;
    const platformKey = platformMapping[platform];
    const easBuildConfig = eas?.[platformKey];
    const customBuildConfig = customBuild?.[platformKey];
    if (customBuildConfig && easBuildConfig) {
      throw new BuildError(
        `Both custom custom builds and EAS builds are configured for ${platform}. Please use only one build method.`,
        null
      );
    }

    if (customBuildConfig?.buildCommand !== undefined) {
      return BuildType.Custom;
    }

    if (easBuildConfig) {
      return BuildType.Eas;
    }

    if (await isExpoGoProject(appRoot)) {
      return BuildType.ExpoGo;
    }

    return BuildType.Local;
  }

  private createBuildConfig<Platform extends DevicePlatform>(
    appRoot: string,
    platform: Platform,
    forceCleanBuild: boolean,
    launchConfiguration: LaunchConfigurationOptions,
    buildType: BuildType
  ): BuildConfig & { platform: Platform } {
    const { customBuild, eas, env, android, ios } = launchConfiguration;
    const platformMapping = {
      [DevicePlatform.Android]: "android",
      [DevicePlatform.IOS]: "ios",
    } as const;
    const platformKey = platformMapping[platform];

    switch (buildType) {
      case BuildType.Local: {
        if (platform === DevicePlatform.IOS) {
          return {
            appRoot,
            platform: platform as DevicePlatform.IOS & Platform,
            forceCleanBuild,
            env,
            type: BuildType.Local,
            scheme: ios?.scheme,
            configuration: ios?.configuration,
          };
        } else {
          return {
            appRoot,
            platform: platform as DevicePlatform.Android & Platform,
            forceCleanBuild,
            env,
            type: BuildType.Local,
            productFlavor: android?.productFlavor,
            buildType: android?.buildType,
          };
        }
      }
      case BuildType.ExpoGo: {
        return {
          appRoot,
          platform,
          env,
          type: BuildType.ExpoGo,
        };
      }
      case BuildType.Eas: {
        const easBuildConfig = eas?.[platformKey];
        if (easBuildConfig === undefined) {
          throw new BuildError(
            "An EAS build was initialized but no EAS build config was specified in the launch configuration.",
            BuildType.Eas
          );
        }
        return {
          appRoot,
          platform,
          env,
          type: BuildType.Eas,
          config: easBuildConfig,
        };
      }
      case BuildType.Custom: {
        const customBuildConfig = customBuild?.[platformKey];
        if (!customBuildConfig?.buildCommand) {
          throw new BuildError(
            "A custom build was initialized but no custom build command was specified in the launch configuration.",
            BuildType.Custom
          );
        }
        return {
          appRoot,
          platform,
          env,
          type: BuildType.Custom,
          buildCommand: customBuildConfig.buildCommand,
          ...customBuildConfig,
        };
      }
    }
  }

  public startBuild(deviceInfo: DeviceInfo, options: BuildOptions): DisposableBuild<BuildResult> {
    const { clean: forceCleanBuild, progressListener, appRoot, cancelToken } = options;
    const { platform } = deviceInfo;
    const launchConfiguration = getLaunchConfiguration();

    getTelemetryReporter().sendTelemetryEvent("build:requested", {
      platform,
      type: forceCleanBuild ? "clean" : "incremental",
    });

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
      const buildType = await this.inferBuildType(appRoot, platform, launchConfiguration);
      try {
        if (platform === DevicePlatform.Android) {
          this.buildOutputChannel = window.createOutputChannel("Radon IDE (Android build)", {
            log: true,
          });
          this.buildOutputChannel.clear();
          const buildConfig = this.createBuildConfig(
            appRoot,
            platform,
            forceCleanBuild,
            launchConfiguration,
            buildType
          );
          buildResult = await buildAndroid(
            buildConfig,
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
              const installed = await this.dependencyManager.checkPodsInstallationStatus();
              if (!installed) {
                throw new Error("Pods could not be installed automatically.");
              }
              // Installing pods may impact the fingerprint as new pods may be created under the project directory.
              // For this reason we need to recalculate the fingerprint after installing pods.
              buildFingerprint = await this.buildCache.calculateFingerprint(platform);
            }
          };
          const buildConfig = this.createBuildConfig(
            appRoot,
            platform,
            forceCleanBuild,
            launchConfiguration,
            buildType
          );

          buildResult = await buildIos(
            buildConfig,
            cancelToken,
            this.buildOutputChannel,
            progressListener,
            this.dependencyManager,
            installPodsIfNeeded
          );
        }
      } catch (e) {
        if (e instanceof CancelError) {
          throw e; // If the build was canceled we pass the exception up.
        }
        throw new BuildError((e as Error).message, buildType);
      }

      await this.buildCache.storeBuild(buildFingerprint, buildResult);

      return buildResult;
    };

    const disposableBuild = {
      build: buildApp().catch((e: Error) => {
        if (e instanceof CancelError) {
          throw e; // If the build was canceled we pass the exception up.
        }
        if (e instanceof BuildError) {
          throw e;
        }
        throw new BuildError(e.message, null);
      }),
      dispose: () => {
        cancelToken.cancel();
      },
    };
    disposableBuild.build
      .then(() => {
        this.isCachedBuildStale = false;
      })
      .catch(_.noop);

    return disposableBuild;
  }

  private checkIfNativeChangedForPlatform = throttleAsync(async () => {
    if (!this.isCachedBuildStale) {
      const isCacheStale = await this.buildCache.isCacheStale(this.platform);

      if (isCacheStale) {
        this.isCachedBuildStale = true;
        this.buildManagerDelegate.onCacheStale(this.platform);
      }
    }
  }, FINGERPRINT_THROTTLE_MS);

  public dispose() {
    this.workspaceChangeListener.dispose();
    this.buildOutputChannel?.dispose();
  }
}
