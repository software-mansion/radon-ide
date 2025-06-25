import assert from "assert";
import Sinon from "sinon";
import { describe, afterEach, beforeEach, it } from "mocha";

import { BuildType } from "../common/BuildConfig";
import { DevicePlatform } from "../common/DeviceManager";
import { CustomBuild, EasConfig, LaunchConfigurationOptions } from "../common/LaunchConfig";
import { createBuildConfig, inferBuildType } from "./BuildManager";
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

function toPlatformConfig<T>(
  platform: DevicePlatform,
  config: EasConfig | CustomBuild
): { ios: T } | { android: T } {
  return {
    [platform.toLowerCase()]: config,
  } as any;
}

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
            inferBuildType(APP_ROOT, platform, {
              eas: toPlatformConfig(platform, EAS_CONFIG),
              customBuild: toPlatformConfig(platform, CUSTOM_BUILD_CONFIG),
            })
          );
        });

        it("should not reject if other platform's config is invalid", async function () {
          await assert.doesNotReject(async () => {
            inferBuildType(APP_ROOT, platform, {
              eas: toPlatformConfig(otherPlatform, EAS_CONFIG),
              customBuild: toPlatformConfig(otherPlatform, CUSTOM_BUILD_CONFIG),
            });
          });
        });

        it("should return eas build type if eas config is provided", async function () {
          const buildType = await inferBuildType(APP_ROOT, platform, {
            eas: toPlatformConfig(platform, EAS_CONFIG),
          });
          assert.equal(buildType, BuildType.Eas);
        });

        it("should return eas local build type if eas config with `local` flag set is provided", async function () {
          const buildType = await inferBuildType(APP_ROOT, platform, {
            eas: toPlatformConfig(platform, EAS_LOCAL_CONFIG),
          });
          assert.equal(buildType, BuildType.EasLocal);
        });

        it("should return custom build type if custom config is provided", async function () {
          const buildType = await inferBuildType(APP_ROOT, platform, {
            customBuild: toPlatformConfig(platform, CUSTOM_BUILD_CONFIG),
          });
          assert.equal(buildType, BuildType.Custom);
        });

        it("should check if project uses Expo Go", async function () {
          isExpoGoProjectStub.returns(true);
          await inferBuildType(APP_ROOT, platform, {});
          assert(isExpoGoProjectStub.calledOnceWith(APP_ROOT));
        });

        it("should return expo go build type if project uses Expo Go", async function () {
          isExpoGoProjectStub.returns(true);
          const buildType = await inferBuildType(APP_ROOT, platform, {});
          assert.equal(buildType, BuildType.ExpoGo);
        });

        it("should return Local build type if project does not use Expo Go", async function () {
          isExpoGoProjectStub.returns(false);
          const buildType = await inferBuildType(APP_ROOT, platform, {});
          assert.equal(buildType, BuildType.Local);
        });
      });

      describe("createBuildConfig", function () {
        const launchConfigByType = new Map<BuildType, LaunchConfigurationOptions>([
          [
            BuildType.Custom,
            {
              customBuild: toPlatformConfig(platform, CUSTOM_BUILD_CONFIG),
            },
          ],
          [
            BuildType.Eas,
            {
              eas: toPlatformConfig(platform, EAS_CONFIG),
            },
          ],
          [
            BuildType.EasLocal,
            {
              eas: toPlatformConfig(platform, EAS_LOCAL_CONFIG),
            },
          ],
          [BuildType.ExpoGo, {}],
          [
            BuildType.Local,
            {
              env: {
                OPTION: "value",
                ANOTHER_OPTION: "another value",
              },
            },
          ],
        ]);

        it(`should include passed information`, async function () {
          launchConfigByType.entries().forEach(([buildType, launchConfig]) => {
            const buildConfig = createBuildConfig(
              APP_ROOT,
              platform,
              false,
              launchConfig,
              buildType
            );
            assert.equal(buildConfig.platform, platform);
            assert.equal(buildConfig.type, buildType);
            assert.equal(buildConfig.appRoot, APP_ROOT);
            assert.equal(buildConfig.env, launchConfig.env);
          });
        });
      });
    });
  });
});
