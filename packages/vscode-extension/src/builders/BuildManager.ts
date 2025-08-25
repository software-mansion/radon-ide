import assert from "assert";
import _ from "lodash";
import { OutputChannel } from "vscode";
import crypto from "crypto";
import stableStringify from "fast-json-stable-stringify";
import { BuildCache } from "./BuildCache";
import { AndroidBuildResult, buildAndroid } from "./buildAndroid";
import { IOSBuildResult, buildIos } from "./buildIOS";
import { CancelError, CancelToken } from "../utilities/cancelToken";
import { getTelemetryReporter } from "../utilities/telemetry";
import { Logger } from "../Logger";
import { BuildConfig, BuildType } from "../common/BuildConfig";
import { isExpoGoProject } from "./expoGo";
import { ResolvedLaunchConfig } from "../project/ApplicationContext";
import { DevicePlatform, IOSDeviceInfo } from "../common/State";
import { DeviceBase } from "../devices/DeviceBase";
import { FingerprintProvider } from "../project/FingerprintProvider";

// Branded type for build fingerprints to ensure type safety
export type BuildFingerprint = string & { readonly __brand: "BuildFingerprint" };

export type BuildResult = { fingerprint: BuildFingerprint } & (IOSBuildResult | AndroidBuildResult);

export interface BuildManager {
  buildApp(buildConfig: BuildConfig, options: BuildOptions): Promise<BuildResult>;
  calculateBuildFingerprint(buildConfig: BuildConfig): Promise<BuildFingerprint>;
}

export type BuildOptions = {
  buildOutputChannel: OutputChannel;
  progressListener: (newProgress: number) => void;
  cancelToken: CancelToken;
  forceCleanBuild: boolean;
};

export class BuildError extends Error {
  constructor(
    message: string,
    public readonly buildType: BuildType | null
  ) {
    super(message);
  }
}

export function createBuildConfig(
  device: DeviceBase,
  launchConfiguration: ResolvedLaunchConfig,
  buildType: BuildType
): BuildConfig {
  const appRoot = launchConfiguration.absoluteAppRoot;
  const { customBuild, eas, env, android, ios, usePrebuild } = launchConfiguration;
  const platformMapping = {
    [DevicePlatform.Android]: "android",
    [DevicePlatform.IOS]: "ios",
  } as const;
  const platform = device.platform;
  const platformKey = platformMapping[platform];
  const fingerprintCommand = customBuild?.[platformKey]?.fingerprintCommand;

  switch (buildType) {
    case BuildType.Local: {
      if (platform === DevicePlatform.IOS) {
        const iosDeviceInfo = device.deviceInfo as IOSDeviceInfo;
        const runtime = iosDeviceInfo.runtimeInfo;
        if (!runtime) {
          throw new BuildError(
            "No available runtime for the selected device. Cannot perform build.",
            BuildType.Local
          );
        }
        return {
          appRoot,
          platform: platform as DevicePlatform.IOS,
          env,
          type: BuildType.Local,
          scheme: ios?.scheme,
          configuration: ios?.configuration,
          fingerprintCommand,
          usePrebuild,
          runtimeId: runtime.identifier,
        };
      } else {
        return {
          appRoot,
          platform: platform as DevicePlatform.Android,
          env,
          type: BuildType.Local,
          productFlavor: android?.productFlavor,
          buildType: android?.buildType,
          fingerprintCommand,
          usePrebuild,
        };
      }
    }
    case BuildType.ExpoGo: {
      return {
        appRoot,
        platform,
        env,
        type: BuildType.ExpoGo,
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
        ...customBuildConfig,
      };
    }
  }
}

export async function inferBuildType(
  platform: DevicePlatform,
  launchConfiguration: ResolvedLaunchConfig
): Promise<BuildType> {
  const { absoluteAppRoot, customBuild, eas, usePrebuild } = launchConfiguration;
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

  if (!usePrebuild && (await isExpoGoProject(absoluteAppRoot, platform))) {
    return BuildType.ExpoGo;
  }

  return BuildType.Local;
}

export class BuildManagerImpl implements BuildManager {
  constructor(
    private readonly buildCache: BuildCache,
    private readonly fingerprintProvider: FingerprintProvider
  ) {}

  public async calculateBuildFingerprint(buildConfig: BuildConfig): Promise<BuildFingerprint> {
    // the build fingerprint that we use need to include all inputs that may result in the
    // build output being different. We use a combination of the 'project fingerprint' as returned
    // by expo-fingerprint (or the custom fingerprint command) and a deterministic hash of the
    // build config options.
    // finally, for readability we add platform prefix to the fingerprint.
    const buildConfigDeterministicHash = crypto.createHash("md5");
    buildConfigDeterministicHash.update(stableStringify(buildConfig));
    const appFingerprint = await this.fingerprintProvider.calculateFingerprint(buildConfig);
    return `${buildConfig.platform}:${appFingerprint}:${buildConfigDeterministicHash.digest("hex")}` as BuildFingerprint;
  }

  public async buildApp(buildConfig: BuildConfig, options: BuildOptions): Promise<BuildResult> {
    const { forceCleanBuild, buildOutputChannel } = options;
    const { platform, type: buildType } = buildConfig;

    getTelemetryReporter().sendTelemetryEvent("build:requested", {
      platform,
      type: forceCleanBuild ? "clean" : "incremental",
    });

    const currentFingerprint = await this.calculateBuildFingerprint(buildConfig);

    if (forceCleanBuild) {
      // we reset the cache when force clean build is requested as the newly
      // started build may end up being cancelled
      Logger.debug(
        "Build cache is being invalidated",
        forceCleanBuild ? "on request" : "due to build dependencies change"
      );
      await this.buildCache.clearCache(currentFingerprint);
    } else {
      const cachedBuild = await this.buildCache.getBuild(currentFingerprint);
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
    try {
      if (platform === DevicePlatform.Android) {
        buildOutputChannel.clear();

        assert(
          buildConfig.platform === DevicePlatform.Android,
          "Expected build config platform to be Android"
        );
        const androidBuildResult = await buildAndroid(
          buildConfig as BuildConfig & { platform: DevicePlatform.Android },
          options
        );
        buildResult = {
          fingerprint: currentFingerprint,
          ...androidBuildResult,
        };
      } else {
        buildOutputChannel.clear();

        assert(
          buildConfig.platform === DevicePlatform.IOS,
          "Expected build config platform to be iOS"
        );
        const iosBuildResult = await buildIos(
          buildConfig as BuildConfig & { platform: DevicePlatform.IOS },
          options
        );
        buildResult = {
          fingerprint: currentFingerprint,
          ...iosBuildResult,
        };
      }
    } catch (e) {
      if (e instanceof CancelError) {
        throw e; // If the build was canceled we pass the exception up.
      }
      throw new BuildError((e as Error).message, buildType);
    }

    try {
      await this.buildCache.storeBuild(buildResult);
    } catch (e) {
      // NOTE: this is a fallible operation (since it does file system operations), but we don't want to fail the whole build if we fail to store it in a cache.
      Logger.warn("Failed to store the build in cache.", e);
    }
    return buildResult;
  }
}
