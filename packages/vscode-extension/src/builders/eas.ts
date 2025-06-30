import path from "path";
import os from "os";
import { mkdtemp } from "fs/promises";

import assert from "assert";
import { maxBy } from "lodash";
import { OutputChannel } from "vscode";
import { DevicePlatform } from "../common/DeviceManager";
import { EasConfig } from "../common/LaunchConfig";
import { Logger } from "../Logger";
import { CancelToken } from "../utilities/cancelToken";
import { downloadBinary } from "../utilities/common";
import {
  EASBuild,
  isEasCliInstalled,
  listEasBuilds,
  viewEasBuild,
  generateFingerprint,
  buildLocal,
} from "./easCommand";
import { extractTarApp } from "./utils";

export async function fetchEasBuild(
  cancelToken: CancelToken,
  config: EasConfig,
  platform: DevicePlatform,
  appRoot: string,
  outputChannel: OutputChannel
): Promise<string> {
  if (!(await isEasCliInstalled(appRoot))) {
    throw new Error(
      "Your project uses EAS build, but eas-cli could not be found. Install eas-cli and make sure it's available in your PATH."
    );
  }

  const build = await fetchBuild(config, platform, appRoot);
  let easBinaryPath = await downloadAppFromEas(build, platform, cancelToken);
  Logger.debug(`Using built app from EAS: '${easBinaryPath}'`);
  return easBinaryPath;
}

async function fetchBuild(
  config: EasConfig,
  platform: DevicePlatform,
  appRoot: string
): Promise<EASBuild> {
  if (config.buildUUID) {
    const build = await viewEasBuild(config.buildUUID, platform, appRoot);
    if (!build) {
      throw new Error(
        `Failed to find EAS build artifact with ID ${config.buildUUID} for platform ${platform}. Update your launch configuration and try again.`
      );
    }
    if (build.expired) {
      throw new Error(
        `EAS build artifact with ID ${config.buildUUID} has expired. Update your launch configuration and try again.`
      );
    }

    Logger.debug(`Using EAS build artifact with ID ${build.id}.`);
    return build;
  }

  const localFingerprint = await generateFingerprint(platform, appRoot);

  const builds = await listEasBuilds(
    platform,
    { profile: config.profile, fingerprintHash: localFingerprint.hash },
    appRoot
  );
  if (!builds || builds.length === 0) {
    let message = `Failed to find any EAS build artifacts for ${platform} with ${config.profile} profile and matching the fingerprint of the local workspace.`;
    message +=
      "\nYou can run `eas fingerprint:compare` in a terminal to check why the fingerprint doesn't match the available builds.";
    if (platform === DevicePlatform.IOS) {
      message += `\nMake sure you set '"ios.simulator": true' option for profile '${config.profile}' in eas.json.`;
    }
    throw new Error(message);
  }
  if (builds.every((build) => build.expired)) {
    throw new Error(
      `All EAS build artifacts for ${platform} with ${config.profile} profile have expired. Create a new EAS build and try again.`
    );
  }

  const build = maxBy(builds, "completedAt");
  assert(build !== undefined, "builds array is non-empty, so there must be a newest build");

  if (
    platform === DevicePlatform.Android &&
    !build.binaryUrl.endsWith(".apk") &&
    !build.binaryUrl.endsWith(".apex")
  ) {
    throw new Error(
      `EAS build artifact was found, but is not a development build in .apk or .apex format. Make sure you set up eas to use a development profile.`
    );
  }

  Logger.debug(`Using EAS build artifact with ID ${build.id}.`);
  return build;
}

export async function performLocalEasBuild(
  profile: string,
  platform: DevicePlatform,
  appRoot: string,
  outputChannel: OutputChannel,
  cancelToken: CancelToken
) {
  const tmpDirectory = await mkdtemp(path.join(os.tmpdir(), "rn-ide-eas-build-"));
  const outputBase = `eas-${profile}`;
  const outputPath =
    platform === DevicePlatform.Android
      ? path.join(tmpDirectory, `${outputBase}.apk`)
      : path.join(tmpDirectory, `${outputBase}.tar.gz`);
  await buildLocal({ platform, profile, outputPath }, appRoot, outputChannel);

  return maybeExtractBinary(platform, outputPath, tmpDirectory);
}

async function downloadAppFromEas(
  build: EASBuild,
  platform: DevicePlatform,
  cancelToken: CancelToken
): Promise<string> {
  const { id, binaryUrl } = build;

  const tmpDirectory = await mkdtemp(path.join(os.tmpdir(), "rn-ide-eas-build-"));
  const binaryPath =
    platform === DevicePlatform.Android
      ? path.join(tmpDirectory, `${id}.apk`)
      : path.join(tmpDirectory, id);

  const success = await downloadBinary(binaryUrl, binaryPath);
  if (!success) {
    throw new Error(
      `EAS build was found at '${binaryUrl}' but could not be downloaded. Verify your Internet connection is stable and try again.`
    );
  }
  return maybeExtractBinary(platform, binaryPath, tmpDirectory);
}

async function maybeExtractBinary(
  platform: DevicePlatform,
  binaryPath: string,
  tmpDirectory: string
) {
  // on iOS we need to extract the .tar.gz archive to get the .app file
  const shouldExtractArchive = platform === DevicePlatform.IOS;
  if (!shouldExtractArchive) {
    return binaryPath;
  }

  const extracted = await extractTarApp(binaryPath, tmpDirectory, DevicePlatform.IOS);
  if (!extracted) {
    throw new Error(
      "EAS build was downloaded successfully, but could not be extracted. Verify you have enough disk space and try again."
    );
  }
  return extracted;
}
