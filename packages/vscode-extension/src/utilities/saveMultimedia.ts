import fs from "fs";
import { homedir } from "os";
import path from "path";
import { Uri, window } from "vscode";
import { MultimediaData } from "../common/State";
import { getTimestamp } from "./getTimestamp";
import { Platform } from "./platform";

export async function saveMultimedia(
  multimediaData: MultimediaData,
  defaultSavingLocation?: string
) {
  const extension = path.extname(multimediaData.tempFileLocation);
  const timestamp = getTimestamp();
  const baseFileName = multimediaData.fileName.substring(
    0,
    multimediaData.fileName.length - extension.length
  );
  const newFileName = `${baseFileName} ${timestamp}${extension}`;

  const defaultFolder =
    defaultSavingLocation && fs.existsSync(defaultSavingLocation)
      ? defaultSavingLocation
      : Platform.select({
          macos: path.join(homedir(), "Desktop"),
          windows: homedir(),
          linux: homedir(),
        });
  const defaultUri = Uri.file(path.join(defaultFolder, newFileName));

  // save dialog open the location dialog, it also warns the user if the file already exists
  let saveUri = await window.showSaveDialog({
    defaultUri: defaultUri,
    filters: {
      "Video Files": [extension],
    },
  });

  if (!saveUri) {
    return false;
  }

  await fs.promises.copyFile(multimediaData.tempFileLocation, saveUri.fsPath);
  return true;
}
