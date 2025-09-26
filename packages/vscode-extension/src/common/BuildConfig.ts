import { JSONValue } from "../utilities/json";
import { DevicePlatform } from "./State";

export enum BuildType {
  Local = "local",
  ExpoGo = "expoGo",
  DevClient = "devClient",
  Eas = "eas",
  EasLocal = "easLocal",
  Custom = "custom",
}

type BuildConfigCommon = {
  appRoot: string;
  platform: DevicePlatform;
  env?: Record<string, string>;
  fingerprintCommand?: string;
};

export type CustomBuildConfig = {
  type: BuildType.Custom;
  buildCommand: string;
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
  usePrebuild: boolean;
  buildType?: string;
  productFlavor?: string;
} & BuildConfigCommon;

export type IOSLocalBuildConfig = {
  type: BuildType.Local;
  platform: DevicePlatform.IOS;
  usePrebuild: boolean;
  scheme?: string;
  configuration?: string;
  runtimeId: string;
} & BuildConfigCommon;

export type AndroidDevClientBuildConfig = {
  type: BuildType.DevClient;
  platform: DevicePlatform.Android;
  buildType?: string;
  productFlavor?: string;
} & BuildConfigCommon;

export type IOSDevClientBuildConfig = {
  type: BuildType.DevClient;
  platform: DevicePlatform.IOS;
  scheme?: string;
  configuration?: string;
  runtimeId: string;
} & BuildConfigCommon;

export type BuildConfig =
  | CustomBuildConfig
  | ExpoGoBuildConfig
  | AndroidDevClientBuildConfig
  | IOSDevClientBuildConfig
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

// verify that the build config types are json-serializable:
type _EnsureJSONSerializable = IsSuperTypeOf<JSONValue, BuildConfig>;
