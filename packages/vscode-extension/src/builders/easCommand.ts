import { DevicePlatform } from "../common/DeviceManager";
import { getAppRootFolder } from "../utilities/extensionContext";
import { exec } from "../utilities/subprocess";

type UnixTimestamp = number;

export type EASBuild = {
  platform: DevicePlatform;
  binaryUrl: string;
  appVersion: string;
  completedAt: UnixTimestamp;
  expired: boolean;
};

type IsoTimestamp = string; // e.g. "2024-09-04T09:44:07.001Z"
type UUID = string;
type Version = string; // e.g. "50.0.0"

type EASBuildJson = {
  id: string;
  status: "FINISHED" | "CANCELLED" | string;
  platform: "ANDROID" | "IOS";
  artifacts: {
    buildUrl: string;
    applicationArchiveUrl: string;
  };
  initiatingActor: {
    id: UUID;
    displayName: string;
  };
  project: {
    id: UUID;
    name: string;
    slug: string;
    ownerAccount: {
      id: UUID;
      name: string;
    };
  };
  distribution: string; // e.g. "INTERNAL";
  buildProfile: string; // e.g. "development"
  sdkVersion: Version;
  appVersion: Version;
  appBuildVersion: string;
  gitCommitHash: string;
  gitCommitMessage: string;
  priority: string; // e.g. "NORMAL_PLUS"
  createdAt: IsoTimestamp;
  updatedAt: IsoTimestamp;
  completedAt: IsoTimestamp;
  expirationDate: IsoTimestamp;
  isForIosSimulator: false;
};

export async function listEasBuilds(platform: DevicePlatform, profile: string) {
  const platformMapping = { [DevicePlatform.Android]: "android", [DevicePlatform.IOS]: "ios" };

  const { stdout } = await exec(
    "eas",
    [
      "build:list",
      "--non-interactive",
      "--json",
      "--platform",
      platformMapping[platform],
      "--profile",
      profile,
    ],
    { cwd: getAppRootFolder() }
  );
  return parseEasBuildOutput(stdout, platform);
}

export async function viewEasBuild(buildUUID: UUID, platform: DevicePlatform) {
  const { stdout } = await exec("eas", ["build:view", buildUUID, "--json"], {
    cwd: getAppRootFolder(),
  });
  return parseEasBuildOutput(stdout, platform)?.at(0);
}

function parseEasBuildOutput(stdout: string, platform: DevicePlatform): EASBuild[] | undefined {
  const platformMapping = { ANDROID: DevicePlatform.Android, IOS: DevicePlatform.IOS };

  let buildInfo: EASBuildJson[];
  // Supports eas build, eas build:list, eas build:view outputs
  buildInfo = [JSON.parse(stdout)].flat();

  return buildInfo
    .filter(({ status, isForIosSimulator, platform: easPlatform }) => {
      const isFinished = status === "FINISHED";
      const isUsableForDevice =
        (easPlatform === "IOS" && isForIosSimulator) || easPlatform === "ANDROID";

      return isFinished && isUsableForDevice && platformMapping[easPlatform] === platform;
    })
    .map(({ platform: easPlatform, artifacts, completedAt, appVersion, expirationDate }) => {
      return {
        platform: platformMapping[easPlatform],
        binaryUrl: artifacts.applicationArchiveUrl,
        appVersion,
        completedAt: Date.parse(completedAt),
        expired: Date.parse(expirationDate) < Date.now(),
      };
    });
}
