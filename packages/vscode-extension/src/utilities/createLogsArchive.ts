import fs from "fs";
import path from "path";
import * as tar from "tar";
import { tmpdir } from "os";
import { Logger } from "../Logger";

/**
 * Creates a tar.gz archive from an array of log files.
 * Returns the path to the created temporary archive file.
 *
 * @param logDir - The directory containing the log files
 * @param logFileNames - Array of log file names (relative to logDir)
 * @returns Path to the temporary tar.gz file
 */
export async function createLogsArchive(logDir: string, logFileNames: string[]): Promise<string> {
  const timestamp = Date.now();
  const tempArchivePath = path.join(tmpdir(), `radon-ide-logs-${timestamp}.tar.gz`);

  const existingFiles = await Promise.all(
    logFileNames.map(async (fileName) => {
      const fullPath = path.join(logDir, fileName);
      try {
        await fs.promises.access(fullPath);
        return fileName;
      } catch {
        return null;
      }
    })
  );

  const filesToArchive = existingFiles.filter((f): f is string => f !== null);

  if (filesToArchive.length === 0) {
    Logger.warn("[CreateLogsArchive] No valid log files found to archive");
  }

  await tar.create(
    {
      gzip: true,
      file: tempArchivePath,
      cwd: logDir,
    },
    filesToArchive
  );

  return tempArchivePath;
}
