import assert from "assert";
import { Disposable, OutputChannel, window } from "vscode";
import _ from "lodash";
import { BuildCache } from "./BuildCache";
import { AndroidBuildResult, buildAndroid } from "./buildAndroid";
import { IOSBuildResult, buildIos } from "./buildIOS";
import { DevicePlatform } from "../common/DeviceManager";
import { DependencyManager } from "../dependency/DependencyManager";
import { CancelError, CancelToken } from "../utilities/cancelToken";
import { getTelemetryReporter } from "../utilities/telemetry";
import { Logger } from "../Logger";
import { BuildConfig, BuildType } from "../common/BuildConfig";
import { isExpoGoProject } from "./expoGo";
import { LaunchConfigurationOptions } from "../common/LaunchConfig";

export type BuildResult = IOSBuildResult | AndroidBuildResult;

type BuildOptions = {
  progressListener: (newProgress: number) => void;
  cancelToken: CancelToken;
};

class BuildInProgress {
  private counter = 1;
  private progressListeners: ((newProgress: number) => void)[] = [];

  constructor(
    public readonly buildConfig: BuildConfig,
    public readonly promise: Promise<BuildResult>,
    private readonly cancelToken: CancelToken
  ) {}

  public increment() {
    this.counter++;
  }

  public decrement() {
    this.counter--;
    if (this.counter <= 0) {
      this.cancelToken.cancel();
    }
  }

  public addProgressListener(listener: (newProgress: number) => void) {
    this.progressListeners.push(listener);
  }

  public removeProgressListener(listener: (newProgress: number) => void) {
    _.remove(this.progressListeners, (l) => l === listener);
  }

  public onProgress(newProgress: number) {
    for (const listener of this.progressListeners.slice()) {
      listener(newProgress);
    }
  }
}
export class BuildError extends Error {
  constructor(
    message: string,
    public readonly buildType: BuildType | null
  ) {
    super(message);
  }
}

export function createBuildConfig<Platform extends DevicePlatform>(
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
        forceCleanBuild,
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
        forceCleanBuild,
      };
    }
    case BuildType.EasLocal: {
      const easBuildConfig = eas?.[platformKey];
      if (easBuildConfig === undefined) {
        throw new BuildError(
          "A local EAS build was initialized but no EAS build config was specified in the launch configuration.",
          BuildType.EasLocal
        );
      }
      return {
        appRoot,
        platform,
        env,
        type: BuildType.EasLocal,
        profile: easBuildConfig.profile,
        forceCleanBuild,
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
        forceCleanBuild,
        ...customBuildConfig,
      };
    }
  }
}

export async function inferBuildType(
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
    if (easBuildConfig.local) {
      return BuildType.EasLocal;
    } else {
      return BuildType.Eas;
    }
  }

  if (await isExpoGoProject(appRoot)) {
    return BuildType.ExpoGo;
  }

  return BuildType.Local;
}

export class BuildManager implements Disposable {
  constructor(
    private readonly dependencyManager: DependencyManager,
    private readonly buildCache: BuildCache
  ) {
    // Note: in future implementations decoupled from device session we
    // should make this logic platform independent
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
  private async checkBuildDependenciesChanged(platform: DevicePlatform): Promise<boolean> {
    if (platform === DevicePlatform.IOS) {
      return !(await this.dependencyManager.checkPodsInstallationStatus());
    }
    return false;
  }

  private buildsInProgress: Map<string, BuildInProgress> = new Map();

  private makeBuildKey(buildConfig: BuildConfig) {
    return `${buildConfig.platform}:${buildConfig.type}:${buildConfig.appRoot}`;
  }

  public async requestBuild(buildConfig: BuildConfig, options: BuildOptions): Promise<BuildResult> {
    const { progressListener, cancelToken } = options;
    const buildKey = this.makeBuildKey(buildConfig);

    if (this.buildsInProgress.has(buildKey)) {
      Logger.debug("Build already in progress for this configuration, reusing the promise.");
      const existingBuild = this.buildsInProgress.get(buildKey);
      if (existingBuild) {
        existingBuild.increment();
        existingBuild.addProgressListener(progressListener);
        cancelToken.onCancel(() => {
          existingBuild.decrement();
          existingBuild.removeProgressListener(progressListener);
        });
        return existingBuild.promise;
      }
    }

    const cancelTokenForBuild = new CancelToken();
    const buildInProgress = new BuildInProgress(
      buildConfig,
      this.buildApp(buildConfig, {
        cancelToken: cancelTokenForBuild,
        progressListener: (newProgress) => {
          buildInProgress.onProgress(newProgress);
        },
      }),
      cancelTokenForBuild
    );
    cancelTokenForBuild.onCancel(() => {
      if (this.buildsInProgress.get(buildKey) === buildInProgress) {
        Logger.debug("Build was canceled by the user.");
        this.buildsInProgress.delete(buildKey);
      }
    });
    buildInProgress.addProgressListener(progressListener);
    cancelToken.onCancel(() => {
      buildInProgress.decrement();
      buildInProgress.removeProgressListener(progressListener);
    });
    this.buildsInProgress.set(buildKey, buildInProgress);
    try {
      return await buildInProgress.promise;
    } finally {
      if (this.buildsInProgress.get(buildKey) === buildInProgress) {
        this.buildsInProgress.delete(buildKey);
      }
    }
  }

  public async buildApp(buildConfig: BuildConfig, options: BuildOptions): Promise<BuildResult> {
    const { progressListener, cancelToken } = options;
    const { forceCleanBuild, platform, type: buildType } = buildConfig;

    getTelemetryReporter().sendTelemetryEvent("build:requested", {
      platform,
      type: forceCleanBuild ? "clean" : "incremental",
    });

    const currentFingerprint = await this.buildCache.calculateFingerprint(platform);

    // Native build dependencies when changed, should invalidate cached build (even if the fingerprint is the same)
    const buildDependenciesChanged = await this.checkBuildDependenciesChanged(platform);

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

    Logger.debug("Starting native build – no build cached, cache has been invalidated or is stale");
    getTelemetryReporter().sendTelemetryEvent("build:start", { platform });

    let buildResult: BuildResult;
    let buildFingerprint = currentFingerprint;
    try {
      if (platform === DevicePlatform.Android) {
        this.buildOutputChannel = window.createOutputChannel("Radon IDE (Android build)", {
          log: true,
        });
        this.buildOutputChannel.clear();

        assert(
          buildConfig.platform === DevicePlatform.Android,
          "Expected build config platform to be iOS"
        );
        buildResult = await buildAndroid(
          buildConfig as BuildConfig & { platform: DevicePlatform.Android },
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

        assert(
          buildConfig.platform === DevicePlatform.IOS,
          "Expected build config platform to be iOS"
        );
        buildResult = await buildIos(
          buildConfig as BuildConfig & { platform: DevicePlatform.IOS },
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

    try {
      await this.buildCache.storeBuild(buildFingerprint, buildResult);
    } catch (e) {
      // NOTE: this is a fallible operation (since it does file system operations), but we don't want to fail the whole build if we fail to store it in a cache.
      Logger.warn("Failed to store the build in cache.", e);
    }
    return buildResult;
  }

  public dispose() {
    this.buildOutputChannel?.dispose();
  }
}
