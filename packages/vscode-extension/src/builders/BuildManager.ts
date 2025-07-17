import assert from "assert";
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
import { LaunchConfiguration } from "../common/LaunchConfig";
import { OutputChannelRegistry } from "../project/OutputChannelRegistry";
import { Output } from "../common/OutputChannel";

export type BuildResult = IOSBuildResult | AndroidBuildResult;

export interface BuildManager {
  buildApp(buildConfig: BuildConfig, options: BuildOptions): Promise<BuildResult>;
}

export type BuildOptions = {
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

export function createBuildConfig<Platform extends DevicePlatform>(
  platform: Platform,
  forceCleanBuild: boolean,
  launchConfiguration: LaunchConfiguration,
  buildType: BuildType
): BuildConfig & { platform: Platform } {
  const appRoot = launchConfiguration.absoluteAppRoot;
  const { customBuild, eas, env, android, ios } = launchConfiguration;
  const platformMapping = {
    [DevicePlatform.Android]: "android",
    [DevicePlatform.IOS]: "ios",
  } as const;
  const platformKey = platformMapping[platform];
  const fingerprintCommand = customBuild?.[platformKey]?.fingerprintCommand;

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
          fingerprintCommand,
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
          fingerprintCommand,
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
        fingerprintCommand,
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
        fingerprintCommand,
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
        fingerprintCommand,
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
  platform: DevicePlatform,
  launchConfiguration: LaunchConfiguration
): Promise<BuildType> {
  const { absoluteAppRoot, customBuild, eas } = launchConfiguration;
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

  if (await isExpoGoProject(absoluteAppRoot)) {
    return BuildType.ExpoGo;
  }

  return BuildType.Local;
}

export class BuildManagerImpl implements BuildManager {
  constructor(
    private readonly dependencyManager: DependencyManager,
    private readonly buildCache: BuildCache,
    private readonly outputChannelRegistry: OutputChannelRegistry
  ) {}

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

  public async buildApp(buildConfig: BuildConfig, options: BuildOptions): Promise<BuildResult> {
    const { progressListener, cancelToken } = options;
    const { forceCleanBuild, platform, type: buildType, appRoot } = buildConfig;
    const fingerprintOptions = {
      appRoot: buildConfig.appRoot,
      env: buildConfig.env,
      fingerprintCommand: buildConfig.fingerprintCommand,
    };
    const buildCacheKey = {
      platform,
      appRoot,
      env: buildConfig.env ?? {},
    };

    getTelemetryReporter().sendTelemetryEvent("build:requested", {
      platform,
      type: forceCleanBuild ? "clean" : "incremental",
    });

    const currentFingerprint = await this.buildCache.calculateFingerprint(fingerprintOptions);

    // Native build dependencies when changed, should invalidate cached build (even if the fingerprint is the same)
    const buildDependenciesChanged = await this.checkBuildDependenciesChanged(platform);

    if (forceCleanBuild || buildDependenciesChanged) {
      // we reset the cache when force clean build is requested as the newly
      // started build may end up being cancelled
      Logger.debug(
        "Build cache is being invalidated",
        forceCleanBuild ? "on request" : "due to build dependencies change"
      );
      await this.buildCache.clearCache(buildCacheKey);
    } else {
      const cachedBuild = await this.buildCache.getBuild(currentFingerprint, buildCacheKey);
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
        const buildOutputChannel = this.outputChannelRegistry.getOrCreateOutputChannel(
          Output.BuildAndroid
        );
        buildOutputChannel.clear();

        assert(
          buildConfig.platform === DevicePlatform.Android,
          "Expected build config platform to be iOS"
        );
        buildResult = await buildAndroid(
          buildConfig as BuildConfig & { platform: DevicePlatform.Android },
          cancelToken,
          buildOutputChannel,
          progressListener,
          this.dependencyManager
        );
      } else {
        const buildOutputChannel = this.outputChannelRegistry.getOrCreateOutputChannel(
          Output.BuildIos
        );
        buildOutputChannel.clear();
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
            await this.dependencyManager.installPods(buildOutputChannel, cancelToken);
            const installed = await this.dependencyManager.checkPodsInstallationStatus();
            if (!installed) {
              throw new Error("Pods could not be installed automatically.");
            }
            // Installing pods may impact the fingerprint as new pods may be created under the project directory.
            // For this reason we need to recalculate the fingerprint after installing pods.
            buildFingerprint = await this.buildCache.calculateFingerprint(fingerprintOptions);
          }
        };

        assert(
          buildConfig.platform === DevicePlatform.IOS,
          "Expected build config platform to be iOS"
        );
        buildResult = await buildIos(
          buildConfig as BuildConfig & { platform: DevicePlatform.IOS },
          cancelToken,
          buildOutputChannel,
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
      await this.buildCache.storeBuild(buildFingerprint, buildCacheKey, buildResult);
    } catch (e) {
      // NOTE: this is a fallible operation (since it does file system operations), but we don't want to fail the whole build if we fail to store it in a cache.
      Logger.warn("Failed to store the build in cache.", e);
    }
    return buildResult;
  }
}
