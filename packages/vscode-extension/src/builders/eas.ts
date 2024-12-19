import path from "path";
import os from "os";
import { mkdtemp, readdir } from "fs/promises";
import maxBy from "lodash/maxBy";

import { DevicePlatform } from "../common/DeviceManager";
import { EasConfig } from "../common/LaunchConfig";
import { Logger } from "../Logger";
import { CancelToken } from "./cancelToken";
import { exec } from "../utilities/subprocess";
import { downloadBinary } from "../utilities/common";
import { EASBuild, listEasBuilds, viewEasBuild } from "./easCommand";

export async function fetchEasBuild(
  cancelToken: CancelToken,
  config: EasConfig,
  platform: DevicePlatform
): Promise<string | undefined> {
  const build = await fetchBuild(config, platform);
  if (!build) {
    return undefined;
  }

  let easBinaryPath = await downloadAppFromEas(build, platform, cancelToken);
  if (!easBinaryPath) {
    return undefined;
  }

  Logger.debug(`Using built app from EAS: '${easBinaryPath}'`);
  return easBinaryPath;
}

async function fetchBuild(config: EasConfig, platform: DevicePlatform) {
  if (config.buildUUID) {
    const build = await viewEasBuild(config.buildUUID, platform);
    if (!build) {
      Logger.error(
        `Failed to find EAS build artifact with ID ${config.buildUUID} for platform ${platform}.`
      );
      return undefined;
    }
    if (build.expired) {
      Logger.error(`EAS build artifact with ID ${config.buildUUID} has expired.`);
      return undefined;
    }

    Logger.debug(`Using EAS build artifact with ID ${build.id}.`);
    return build;
  }

  const builds = await listEasBuilds(platform, config.profile);
  if (!builds || builds.length === 0) {
    Logger.error(
      `Failed to find any EAS build artifacts for ${platform} with ${config.profile} profile. If you're building iOS app, make sure you set '"ios.simulator": true' option in eas.json.`
    );
    return undefined;
  }
  if (builds.every((build) => build.expired)) {
    Logger.error(
      `All EAS build artifacts for ${platform} with ${config.profile} profile have expired.`
    );
    return undefined;
  }

  const build = maxBy(builds, "completedAt")!;

  if (
    platform === DevicePlatform.Android &&
    !build.binaryUrl.endsWith(".apk") &&
    !build.binaryUrl.endsWith(".apex")
  ) {
    Logger.error(
      `EAS build artifact needs to be a development build in .apk or .apex format to work with the Radon IDE, make sure you set up eas to use "development" profile`
    );
    return undefined;
  }

  Logger.debug(`Using EAS build artifact with ID ${build.id}.`);
  return build;
}

async function downloadAppFromEas(
  build: EASBuild,
  platform: DevicePlatform,
  cancelToken: CancelToken
) {
  function isAppFile(name: string) {
    return name.endsWith(".app");
  }

  const { id, binaryUrl } = build;

  const tmpDirectory = await mkdtemp(path.join(os.tmpdir(), "rn-ide-eas-build-"));
  const binaryPath =
    platform === DevicePlatform.Android
      ? path.join(tmpDirectory, `${id}.apk`)
      : path.join(tmpDirectory, id);

  const success = await downloadBinary(binaryUrl, binaryPath);
  if (!success) {
    Logger.error(`Failed to download archive from '${binaryUrl}'.`);
    return undefined;
  }
  // on iOS we need to extract the .tar.gz archive to get the .app file
  const shouldExtractArchive = platform === DevicePlatform.IOS;
  if (!shouldExtractArchive) {
    return binaryPath;
  }

  const { failed } = await cancelToken.adapt(
    tarCommand({ archivePath: binaryPath, extractDir: tmpDirectory })
  );
  if (failed) {
    Logger.error(`Failed to extract archive '${binaryPath}' to '${tmpDirectory}'.`);
    return undefined;
  }

  // assuming that the archive contains only one .app file
  const appName = (await readdir(tmpDirectory)).find(isAppFile);
  if (!appName) {
    Logger.error(`Failed to find .app in extracted archive '${binaryPath}'.`);
    return undefined;
  }

  const appPath = path.join(tmpDirectory, appName);
  Logger.debug(`Extracted app archive to '${appPath}'.`);
  return appPath;
}

type TarCommandArgs = { archivePath: string; extractDir: string };
function tarCommand({ archivePath, extractDir }: TarCommandArgs) {
  return exec("tar", ["-xf", archivePath, "-C", extractDir]);
}
