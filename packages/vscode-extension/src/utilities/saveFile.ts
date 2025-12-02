import fs from "fs";
import { homedir } from "os";
import path from "path";
import { Uri, window } from "vscode";
import { getTimestamp } from "./getTimestamp";
import { Platform } from "./platform";

export interface SaveFileOptions {
  /**
   * The base name for the file (without extension)
   */
  baseFileName: string;
  /**
   * The file extension (with or without leading dot, e.g., ".zip" or "zip")
   */
  extension: string;
  /**
   * Optional default folder path. If not provided or doesn't exist, uses platform default.
   */
  defaultSavingLocation?: string;
  /**
   * Optional filter label for the save dialog (e.g., "Video Files", "Archive Files")
   */
  filterLabel?: string;
  /**
   * If true, appends a timestamp to the filename
   * @default true
   */
  includeTimestamp?: boolean;
}

/**
 * Opens a save dialog and copies a file to the selected location.
 * Returns the URI where the file was saved, or undefined if cancelled.
 */
export async function saveFile(
  sourceFilePath: string,
  options: SaveFileOptions
): Promise<Uri | undefined> {
  const {
    baseFileName,
    extension,
    defaultSavingLocation,
    filterLabel,
    includeTimestamp = true,
  } = options;

  const normalizedExtension = extension.startsWith(".") ? extension : `.${extension}`;
  const extensionWithoutDot = normalizedExtension.slice(1);

  const timestamp = includeTimestamp ? ` ${getTimestamp()}` : "";
  const newFileName = `${baseFileName}${timestamp}${normalizedExtension}`;

  const defaultFolder =
    defaultSavingLocation && fs.existsSync(defaultSavingLocation)
      ? defaultSavingLocation
      : Platform.select({
          macos: path.join(homedir(), "Desktop"),
          windows: homedir(),
          linux: homedir(),
        });

  const defaultUri = Uri.file(path.join(defaultFolder, newFileName));

  // Open save dialog
  const saveUri = await window.showSaveDialog({
    defaultUri: defaultUri,
    filters: filterLabel
      ? {
          [filterLabel]: [extensionWithoutDot],
        }
      : undefined,
  });

  if (!saveUri) {
    return undefined;
  }

  await fs.promises.copyFile(sourceFilePath, saveUri.fsPath);
  return saveUri;
}
