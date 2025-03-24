import { DevicePlatform } from "../common/DeviceManager";
import { exec } from "../utilities/subprocess";

type UnixTimestamp = number;

export type EASBuild = {
  id: string;
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

export async function isEasCliInstalled(appRoot: string) {
  try {
    await exec("eas", ["--version"], { cwd: appRoot });
    return true;
  } catch {
    return false;
  }
}

type ListEasBuildsOptions = { profile: string; fingerprintHash?: string };

export async function listEasBuilds(
  platform: DevicePlatform,
  { profile, fingerprintHash }: ListEasBuildsOptions,
  appRoot: string
) {
  const platformMapping = { [DevicePlatform.Android]: "android", [DevicePlatform.IOS]: "ios" };

  const commandArgs = [
    "build:list",
    "--non-interactive",
    "--json",
    "--platform",
    platformMapping[platform],
    "--profile",
    profile,
  ];

  if (fingerprintHash !== undefined) {
    commandArgs.push("--fingerprint-hash", fingerprintHash);
  }

  const { stdout } = await exec("eas", commandArgs, { cwd: appRoot });
  return parseEasBuildOutput(stdout, platform);
}

export async function viewEasBuild(buildUUID: UUID, platform: DevicePlatform, appRoot: string) {
  const { stdout } = await exec("eas", ["build:view", buildUUID, "--json"], {
    cwd: appRoot,
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
    .map(({ id, platform: easPlatform, artifacts, completedAt, appVersion, expirationDate }) => {
      return {
        id,
        platform: platformMapping[easPlatform],
        binaryUrl: artifacts.applicationArchiveUrl,
        appVersion,
        completedAt: Date.parse(completedAt),
        expired: Date.parse(expirationDate) < Date.now(),
      };
    });
}

export interface FingerprintDetails {
  hash: string;
}

function isFingerprintDetails(fingerprint: unknown): fingerprint is FingerprintDetails {
  return (
    !!fingerprint &&
    typeof fingerprint === "object" &&
    "hash" in fingerprint &&
    typeof fingerprint.hash === "string"
  );
}

export async function generateFingerprint(
  platform: DevicePlatform,
  appRoot: string
): Promise<FingerprintDetails> {
  const platformMapping = { [DevicePlatform.Android]: "android", [DevicePlatform.IOS]: "ios" };
  const { stdout } = await exec(
    "eas",
    ["fingerprint:generate", "--json", "--non-interactive", "-p", platformMapping[platform]],
    { cwd: appRoot }
  );
  try {
    const result = JSON.parse(stdout);
    if (!isFingerprintDetails(result)) {
      throw new Error();
    }
    return result;
  } catch {
    throw new Error("Failed to generate build fingerprint: the output of eas-cli is malformed");
  }
}
