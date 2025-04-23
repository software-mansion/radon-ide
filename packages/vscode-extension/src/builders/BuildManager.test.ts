import Sinon from "sinon";
import { BuildType } from "../common/BuildConfig";
import { DevicePlatform } from "../common/DeviceManager";
import { CustomBuild, EasConfig, LaunchConfigurationOptions } from "../common/LaunchConfig";
import { DependencyManager } from "../dependency/DependencyManager";
import { BuildManager } from "./BuildManager";
import { BuildCache } from "./BuildCache";
import assert from "assert";
import { describe, afterEach, beforeEach, it } from "mocha";
import * as ExpoGo from "./expoGo";

const APP_ROOT = "appRoot";

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

const EAS_AND_CUSTOM_LAUNCH_CONFIGS: LaunchConfigurationOptions = {
  customBuild: {
    ios: CUSTOM_BUILD_CONFIG,
    android: CUSTOM_BUILD_CONFIG,
  },
  eas: {
    ios: EAS_CONFIG,
    android: EAS_CONFIG,
  },
};

function toPlatformConfig<T>(
  platform: DevicePlatform,
  config: EasConfig | CustomBuild
): { ios: T } | { android: T } {
  return {
    [platform.toLowerCase()]: config,
  } as any;
}

describe("BuildManager", () => {
  let buildManager: BuildManager;
  let dependencyManagerStub: DependencyManager;
  let buildCacheStub: BuildCache;
  let isExpoGoProjectStub: Sinon.SinonStub;

  beforeEach(() => {
    dependencyManagerStub = Sinon.createStubInstance(DependencyManager);
    buildCacheStub = Sinon.createStubInstance(BuildCache);
    buildManager = new BuildManager(dependencyManagerStub, buildCacheStub);
    isExpoGoProjectStub = Sinon.stub(ExpoGo, "isExpoGoProject");
  });

  afterEach(() => {
    isExpoGoProjectStub.restore();
  });

  describe("inferBuildType", function () {
    Object.values(DevicePlatform).forEach((platform) => {
      describe(platform, function () {
        it("should reject if both eas and custom build configs are provided", async function () {
          await assert.rejects(async () =>
            buildManager.inferBuildType(APP_ROOT, platform, EAS_AND_CUSTOM_LAUNCH_CONFIGS)
          );
        });

        it("should return eas build type if eas config is provided", async function () {
          const buildType = await buildManager.inferBuildType(APP_ROOT, platform, {
            eas: toPlatformConfig(platform, EAS_CONFIG),
          });
          assert.equal(buildType, BuildType.Eas);
        });

        it("should return eas local build type if eas local config is provided", async function () {
          const buildType = await buildManager.inferBuildType(APP_ROOT, platform, {
            eas: toPlatformConfig(platform, EAS_LOCAL_CONFIG),
          });
          assert.equal(buildType, BuildType.EasLocal);
        });

        it("should return custom build type if custom config is provided", async function () {
          const buildType = await buildManager.inferBuildType(APP_ROOT, platform, {
            customBuild: toPlatformConfig(platform, CUSTOM_BUILD_CONFIG),
          });
          assert.equal(buildType, BuildType.Custom);
        });

        it("should check if project uses Expo Go", async function () {
          isExpoGoProjectStub.returns(true);
          await buildManager.inferBuildType(APP_ROOT, platform, {});
          assert(isExpoGoProjectStub.calledOnceWith(APP_ROOT));
        });

        it("should return expo go build type if project uses Expo Go", async function () {
          isExpoGoProjectStub.returns(true);
          const buildType = await buildManager.inferBuildType(APP_ROOT, platform, {});
          assert.equal(buildType, BuildType.ExpoGo);
        });

        it("should return Local build type if project does not use Expo Go", async function () {
          isExpoGoProjectStub.returns(false);
          const buildType = await buildManager.inferBuildType(APP_ROOT, platform, {});
          assert.equal(buildType, BuildType.Local);
        });
      });
    });
  });
});
