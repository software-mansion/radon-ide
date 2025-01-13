import { readdir } from "fs/promises";
import path from "path";
import { Logger } from "../Logger";
import { exec } from "../utilities/subprocess";
import { CancelToken } from "./cancelToken";
import { DevicePlatform } from "../common/DeviceManager";

export function isAppFile(name: string) {
  return name.endsWith(".app");
}

export function isApkFile(name: string) {
  return name.endsWith(".apk");
}

export async function extractTarApp(
  binaryPath: string,
  pathToExtract: string,
  cancelToken: CancelToken,
  platform: DevicePlatform
) {
  const { failed } = await cancelToken.adapt(
    tarCommand({ archivePath: binaryPath, extractDir: pathToExtract })
  );

  if (failed) {
    Logger.error(`Failed to extract archive '${binaryPath}' to '${pathToExtract}'.`);
    return undefined;
  }

  // assuming that the archive contains only one app file
  const appName = (await readdir(pathToExtract)).find(platform === DevicePlatform.Android ? isApkFile : isAppFile);
  if (!appName) {
    Logger.error(`Failed to find the ${platform === DevicePlatform.Android ? '.apk' : '.app'} file in extracted archive '${binaryPath}'.`);
    return undefined;
  }

  const appPath = path.join(pathToExtract, appName);
  Logger.debug(`Extracted app archive to '${appPath}'.`);
  return appPath;
}

type TarCommandArgs = { archivePath: string; extractDir: string };
function tarCommand({ archivePath, extractDir }: TarCommandArgs) {
  return exec("tar", ["-xf", archivePath, "-C", extractDir]);
}
