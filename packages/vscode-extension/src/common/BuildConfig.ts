import { DevicePlatform } from "./DeviceManager";

export enum BuildType {
  Local = "local",
  ExpoGo = "expoGo",
  Eas = "eas",
  EasLocal = "easLocal",
  Custom = "custom",
}

interface BuildConfigCommon {
  appRoot: string;
  platform: DevicePlatform;
  env?: Record<string, string>;
  forceCleanBuild: boolean;
}

export type CustomBuildConfig = {
  type: BuildType.Custom;
  buildCommand: string;
  fingerprintCommand?: string;
} & BuildConfigCommon;

export type ExpoGoBuildConfig = {
  type: BuildType.ExpoGo;
} & BuildConfigCommon;

export type EasBuildConfig = {
  type: BuildType.Eas;
  config: { profile: string; buildUUID?: string };
} & BuildConfigCommon;

export type EasLocalBuildConfig = {
  type: BuildType.EasLocal;
  profile: string;
} & BuildConfigCommon;

export type AndroidLocalBuildConfig = {
  type: BuildType.Local;
  platform: DevicePlatform.Android;
  forceCleanBuild: boolean;
  buildType?: string;
  productFlavor?: string;
} & BuildConfigCommon;

export type IOSLocalBuildConfig = {
  type: BuildType.Local;
  platform: DevicePlatform.IOS;
  forceCleanBuild: boolean;
  scheme?: string;
  configuration?: string;
} & BuildConfigCommon;

export type BuildConfig =
  | CustomBuildConfig
  | ExpoGoBuildConfig
  | EasBuildConfig
  | EasLocalBuildConfig
  | AndroidLocalBuildConfig
  | IOSLocalBuildConfig;

export type IOSBuildConfig = BuildConfig & { platform: DevicePlatform.IOS };
export type AndroidBuildConfig = BuildConfig & { platform: DevicePlatform.Android };

// NOTE: we let typescript verify that the `BuildConfig` union covers all the `BuildType` variants for both platforms
type IsSuperTypeOf<Base, T extends Base> = T;

type SupportedIOSBuildType = IOSBuildConfig["type"];
type SupportedAndroidBuildType = AndroidBuildConfig["type"];
type SupportedBuildType = SupportedIOSBuildType & SupportedAndroidBuildType;

type _SupportsAllBuildTypes = IsSuperTypeOf<SupportedBuildType, BuildType>;
