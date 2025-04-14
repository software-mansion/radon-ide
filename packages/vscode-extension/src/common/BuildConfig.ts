import { DevicePlatform } from "./DeviceManager";

export enum BuildType {
  Local = "local",
  ExpoGo = "expoGo",
  Eas = "eas",
  Custom = "custom",
  Unknown = "unknown",
}

interface BuildConfigCommon {
  appRoot: string;
  forceCleanBuild: boolean;
  platform: DevicePlatform;
  env?: Record<string, string>;
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

export type AndroidLocalBuildConfig = {
  type: BuildType.Local;
  platform: DevicePlatform.Android;
  buildType: string;
  productFlavor: string;
} & BuildConfigCommon;

export type IOSLocaBuildConfig = {
  type: BuildType.Local;
  platform: DevicePlatform.IOS;
  scheme: string | null;
  configuration: string | null;
} & BuildConfigCommon;

export type BuildConfig =
  | CustomBuildConfig
  | ExpoGoBuildConfig
  | EasBuildConfig
  | AndroidLocalBuildConfig
  | IOSLocaBuildConfig;

// NOTE: we let typescript verify that the `BuildConfig` union covers all the `BuildType` variants for both platforms
type Satisfy<Base, T extends Base> = T;

type IOSBuildConfig = BuildConfig & { platform: DevicePlatform.IOS };
type AndroidBuildConfig = BuildConfig & { platform: DevicePlatform.Android };
type _CoversBuildTypes = Satisfy<
  IOSBuildConfig["type"] & AndroidBuildConfig["type"],
  Exclude<BuildType, BuildType.Unknown>
>;
