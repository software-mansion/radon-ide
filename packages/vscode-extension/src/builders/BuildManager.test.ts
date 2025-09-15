import assert from "assert";
import Sinon from "sinon";
import { describe, afterEach, beforeEach, it } from "mocha";

import { BuildType } from "../common/BuildConfig";
import { CustomBuild, EasConfig } from "../common/LaunchConfig";
import { createBuildConfig, inferBuildType } from "./BuildManager";
import * as ExpoGo from "./expoGo";
import { ResolvedLaunchConfig } from "../project/ApplicationContext";
import { DevicePlatform, DeviceType, AndroidDeviceInfo, IOSDeviceInfo } from "../common/State";
import { DeviceBase } from "../devices/DeviceBase";

const APP_ROOT = "appRoot";
const APP_ROOT_ABSOLUTE = "/appRoot";

const CUSTOM_BUILD_CONFIG: CustomBuild = {
  buildCommand: "build command",
  fingerprintCommand: "fingerprint command",
};

const EAS_CONFIG: EasConfig = {
  profile: "profile",
};

const EAS_LOCAL_CONFIG: EasConfig = {
  profile: "local profile",
  local: true,
};

function toPlatformConfig<T>(
  platform: DevicePlatform,
  config: EasConfig | CustomBuild
): { ios: T } | { android: T } {
  return {
    [platform.toLowerCase()]: config,
  } as any;
}

const COMMON_CONFIG: ResolvedLaunchConfig = {
  appRoot: APP_ROOT,
  absoluteAppRoot: APP_ROOT_ABSOLUTE,
  env: {},
  preview: {
    waitForAppLaunch: true,
  },
  usePrebuild: false,
  useNewDebugger: false,
};

const ANDROID_MOCK_DEVICE_INFO = {
  id: "mock-device",
  platform: DevicePlatform.Android,
  avdId: "mock-avd-id",
  modelId: "mock-model-id",
  systemName: "mock-system",
  displayName: "Mock Android Device",
  deviceType: DeviceType.Phone,
  available: true,
} as AndroidDeviceInfo;

const IOS_MOCK_DEVICE_INFO = {
  id: "mock-device",
  platform: DevicePlatform.IOS,
  UDID: "mock-udid",
  modelId: "mock-model-id",
  systemName: "mock-system",
  displayName: "Mock iOS Device",
  deviceType: DeviceType.Phone,
  available: true,
  runtimeInfo: {
    platform: DevicePlatform.IOS,
    identifier: "mock-runtime-id",
    name: "Mock iOS Runtime",
    version: "0.0",
    supportedDeviceTypes: [],
    available: true,
  },
} as IOSDeviceInfo;

describe("BuildManager", () => {
  Object.values(DevicePlatform).forEach((platform) => {
    describe(platform, function () {
      const otherPlatform =
        platform === DevicePlatform.IOS ? DevicePlatform.Android : DevicePlatform.IOS;

      describe("inferBuildType", function () {
        let isExpoGoProjectStub: Sinon.SinonStub;
        beforeEach(() => {
          isExpoGoProjectStub = Sinon.stub(ExpoGo, "isExpoGoProject");
        });
        afterEach(() => {
          isExpoGoProjectStub.restore();
        });

        it("should reject if both eas and custom build configs are provided", async function () {
          await assert.rejects(async () =>
            inferBuildType(platform, {
              ...COMMON_CONFIG,
              eas: toPlatformConfig(platform, EAS_CONFIG),
              customBuild: toPlatformConfig(platform, CUSTOM_BUILD_CONFIG),
            })
          );
        });

        it("should not reject if other platform's config is invalid", async function () {
          await assert.doesNotReject(async () => {
            inferBuildType(platform, {
              ...COMMON_CONFIG,
              eas: toPlatformConfig(otherPlatform, EAS_CONFIG),
              customBuild: toPlatformConfig(otherPlatform, CUSTOM_BUILD_CONFIG),
            });
          });
        });

        it("should return eas build type if eas config is provided", async function () {
          const buildType = await inferBuildType(platform, {
            ...COMMON_CONFIG,
            eas: toPlatformConfig(platform, EAS_CONFIG),
          });
          assert.equal(buildType, BuildType.Eas);
        });

        it("should return eas local build type if eas config with `local` flag set is provided", async function () {
          const buildType = await inferBuildType(platform, {
            ...COMMON_CONFIG,
            eas: toPlatformConfig(platform, EAS_LOCAL_CONFIG),
          });
          assert.equal(buildType, BuildType.EasLocal);
        });

        it("should return custom build type if custom config is provided", async function () {
          const buildType = await inferBuildType(platform, {
            ...COMMON_CONFIG,
            customBuild: toPlatformConfig(platform, CUSTOM_BUILD_CONFIG),
          });
          assert.equal(buildType, BuildType.Custom);
        });

        it("should check if project uses Expo Go", async function () {
          isExpoGoProjectStub.returns(true);
          await inferBuildType(platform, COMMON_CONFIG);
          assert(isExpoGoProjectStub.calledOnceWith(APP_ROOT_ABSOLUTE));
        });

        it("should return expo go build type if project uses Expo Go", async function () {
          isExpoGoProjectStub.returns(true);
          const buildType = await inferBuildType(platform, COMMON_CONFIG);
          assert.equal(buildType, BuildType.ExpoGo);
        });

        it("should return Local build type if project does not use Expo Go", async function () {
          isExpoGoProjectStub.returns(false);
          const buildType = await inferBuildType(platform, COMMON_CONFIG);
          assert.equal(buildType, BuildType.Local);
        });
      });

      describe("createBuildConfig", function () {
        const launchConfigByType = new Map<BuildType, ResolvedLaunchConfig>();
        launchConfigByType.set(BuildType.Custom, {
          ...COMMON_CONFIG,
          customBuild: toPlatformConfig(platform, CUSTOM_BUILD_CONFIG),
        });
        launchConfigByType.set(BuildType.Eas, {
          ...COMMON_CONFIG,
          eas: toPlatformConfig(platform, EAS_CONFIG),
        });
        launchConfigByType.set(BuildType.EasLocal, {
          ...COMMON_CONFIG,
          eas: toPlatformConfig(platform, EAS_LOCAL_CONFIG),
        });
        launchConfigByType.set(BuildType.ExpoGo, {
          ...COMMON_CONFIG,
        });
        launchConfigByType.set(BuildType.Local, {
          ...COMMON_CONFIG,
          env: {
            OPTION: "value",
            ANOTHER_OPTION: "another value",
          },
        });

        it(`should include passed information`, async function () {
          // Test all build types to ensure they all work correctly
          const entries = Array.from(launchConfigByType.entries());
          for (const [buildType, launchConfig] of entries) {
            const mockDevice = Sinon.createStubInstance(DeviceBase);

            Object.defineProperty(mockDevice, "platform", {
              get: () => platform,
            });
            Object.defineProperty(mockDevice, "deviceInfo", {
              get: () =>
                platform === DevicePlatform.Android
                  ? ANDROID_MOCK_DEVICE_INFO
                  : IOS_MOCK_DEVICE_INFO,
            });

            const buildConfig = createBuildConfig(mockDevice, launchConfig, buildType);
            assert.equal(buildConfig.platform, platform);
            assert.equal(buildConfig.type, buildType);
            assert.equal(buildConfig.appRoot, APP_ROOT_ABSOLUTE);
            assert.equal(buildConfig.env, launchConfig.env);
          }
        });
      });
    });
  });
});
