import { readdir } from "fs/promises";
import path from "path";
import * as tar from "tar";
import { Logger } from "../Logger";
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
  platform: DevicePlatform
) {
  try {
    await tarCommand(binaryPath, pathToExtract);

    // assuming that the archive contains only one app file
    const appName = (await readdir(pathToExtract)).find(
      platform === DevicePlatform.Android ? isApkFile : isAppFile
    );
    if (!appName) {
      Logger.error(
        `Failed to find the ${
          platform === DevicePlatform.Android ? ".apk" : ".app"
        } file in extracted archive '${binaryPath}'.`
      );
      return undefined;
    }

    const appPath = path.join(pathToExtract, appName);
    Logger.debug(`Extracted app archive to '${appPath}'.`);
    return appPath;
  } catch (_) {
    Logger.error(`Failed to extract archive '${binaryPath}' to '${pathToExtract}'.`);
    return undefined;
  }
}

function tarCommand(archivePath: string, extractDir: string) {
  return tar.x({
    f: archivePath,
    C: extractDir,
  });
}
