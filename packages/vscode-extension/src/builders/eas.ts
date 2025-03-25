import path from "path";
import os from "os";
import { mkdtemp } from "fs/promises";

import assert from "assert";
import { maxBy } from "lodash";
import { OutputChannel } from "vscode";
import { DevicePlatform } from "../common/DeviceManager";
import { EasConfig } from "../common/LaunchConfig";
import { Logger } from "../Logger";
import { CancelToken } from "./cancelToken";
import { downloadBinary } from "../utilities/common";
import {
  EASBuild,
  isEasCliInstalled,
  listEasBuilds,
  viewEasBuild,
  generateFingerprint,
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
      "Failed to build iOS app using EAS build. Check if eas-cli is installed and available in PATH."
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
        `Failed to find EAS build artifact with ID ${config.buildUUID} for platform ${platform}.`
      );
    }
    if (build.expired) {
      throw new Error(`EAS build artifact with ID ${config.buildUUID} has expired.`);
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
    throw new Error(
      `Failed to find any EAS build artifacts for ${platform} with ${config.profile} profile. If you're building iOS app, make sure you set '"ios.simulator": true' option in eas.json.`
    );
  }
  if (builds.every((build) => build.expired)) {
    throw new Error(
      `All EAS build artifacts for ${platform} with ${config.profile} profile have expired.`
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
      `EAS build artifact needs to be a development build in .apk or .apex format to work with the Radon IDE, make sure you set up eas to use "development" profile`
    );
  }

  Logger.debug(`Using EAS build artifact with ID ${build.id}.`);
  return build;
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
    throw new Error(`Failed to download archive from '${binaryUrl}'.`);
  }
  // on iOS we need to extract the .tar.gz archive to get the .app file
  const shouldExtractArchive = platform === DevicePlatform.IOS;
  if (!shouldExtractArchive) {
    return binaryPath;
  }

  const extracted = await extractTarApp(binaryPath, tmpDirectory, DevicePlatform.IOS);
  if (!extracted) {
    throw new Error("Failed to extract the downloaded application");
  }
  return extracted;
}
