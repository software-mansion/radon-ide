import { OutputChannel } from "vscode";
import { DevicePlatform } from "../common/DeviceManager";
import { Logger } from "../Logger";
import { exec, lineReader } from "../utilities/subprocess";

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

const DEVICE_TO_EAS_PLATFORM_MAPPING = {
  [DevicePlatform.Android]: "android",
  [DevicePlatform.IOS]: "ios",
};

type ListEasBuildsOptions = { profile: string; fingerprintHash: string };

export async function listEasBuilds(
  platform: DevicePlatform,
  { profile, fingerprintHash }: ListEasBuildsOptions,
  appRoot: string
) {
  const commandArgs = [
    "build:list",
    "--non-interactive",
    "--json",
    "--platform",
    DEVICE_TO_EAS_PLATFORM_MAPPING[platform],
    "--profile",
    profile,
    "--fingerprint-hash",
    fingerprintHash,
  ];

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
  try {
    const { stdout } = await exec(
      "eas",
      [
        "fingerprint:generate",
        "--json",
        "--non-interactive",
        "-p",
        DEVICE_TO_EAS_PLATFORM_MAPPING[platform],
      ],
      { cwd: appRoot }
    );
    const result = JSON.parse(stdout);
    if (!isFingerprintDetails(result)) {
      Logger.error(
        `Failed to parse the fingerprint details. The output seems to be malformed.\n` +
          "`fingerprint:generate` output: " +
          stdout
      );
      throw new Error();
    }
    return result;
  } catch {
    throw new Error(
      "Failed to generate the local workspace fingerprint. Check the extension logs for more details."
    );
  }
}

interface BuildLocalOptions {
  platform: DevicePlatform;
  profile: string;
  outputPath: string;
}

export async function buildLocal(
  { platform, profile, outputPath }: BuildLocalOptions,
  appRoot: string,
  outputChannel: OutputChannel
): Promise<void> {
  const commandArgs = [
    "build",
    "--local",
    "--non-interactive",
    "--profile",
    profile,
    "--platform",
    DEVICE_TO_EAS_PLATFORM_MAPPING[platform],
    "--output",
    outputPath,
  ];
  const buildProcess = exec("eas", commandArgs, { cwd: appRoot, quietErrorsOnExit: true });
  lineReader(buildProcess).onLineRead((line) => {
    outputChannel.appendLine(line);
  });
  try {
    await buildProcess;
  } catch {
    throw new Error("EAS local build failed. See the build logs for details.");
  }
}
