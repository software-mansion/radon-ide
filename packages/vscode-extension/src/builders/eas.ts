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
import { listEasBuilds, viewEasBuild } from "./easCommand";

export async function fetchEasBuild(
  cancelToken: CancelToken,
  config: EasConfig,
  platform: DevicePlatform
): Promise<string | undefined> {
  const binaryUrl = await fetchBuildUrl(config, platform);
  if (!binaryUrl) {
    return undefined;
  }

  let easBinaryPath = await downloadAppFromEas(binaryUrl, platform, cancelToken);
  if (!easBinaryPath) {
    return undefined;
  }

  Logger.debug(`Using built app from EAS: ${easBinaryPath}`);
  return easBinaryPath;
}

async function fetchBuildUrl(config: EasConfig, platform: DevicePlatform) {
  switch (config.useBuildType) {
    case "latest": {
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

      return maxBy(builds, "completedAt")!.binaryUrl;
    }
    case "id": {
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

      return build.binaryUrl;
    }
  }
}

async function downloadAppFromEas(
  binaryUrl: string,
  platform: DevicePlatform,
  cancelToken: CancelToken
) {
  function isAppFile(name: string) {
    return name.endsWith(".app");
  }

  const tmpDirectory = await mkdtemp(path.join(os.tmpdir(), "rn-ide-eas-build-"));
  // URL should be in format "https://expo.dev/artifacts/eas/ID.apk", where ID
  // is unique identifier.
  const binaryPath = await downloadBinary(binaryUrl, tmpDirectory);
  if (!binaryPath) {
    Logger.error(`Failed to download archive from '${binaryUrl}'.`);
    return undefined;
  }
  // on iOS we need to extract the .tar.gz archive to get the .app file
  const shouldExtractArchive = platform === DevicePlatform.IOS;
  if (!shouldExtractArchive) {
    return binaryPath;
  }

  const extractDir = path.dirname(binaryPath);
  const { failed } = await cancelToken.adapt(tarCommand({ archivePath: binaryPath, extractDir }));
  if (failed) {
    Logger.error(`Failed to extract archive '${binaryPath}' to '${extractDir}'.`);
    return undefined;
  }

  // assuming that the archive contains only one .app file
  const appName = (await readdir(extractDir)).find(isAppFile);
  if (!appName) {
    Logger.error(`Failed to find .app in extracted archive '${binaryPath}'.`);
    return undefined;
  }

  const appPath = path.join(extractDir, appName);
  Logger.debug(`Extracted app archive to '${appPath}'.`);
  return appPath;
}

type TarCommandArgs = { archivePath: string; extractDir: string };
function tarCommand({ archivePath, extractDir }: TarCommandArgs) {
  return exec("tar", ["-xf", archivePath, "-C", extractDir]);
}
