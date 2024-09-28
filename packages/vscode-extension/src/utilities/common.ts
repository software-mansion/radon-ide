import os from "os";
import { createHash, Hash } from "crypto";
import path, { join } from "path";
import { Readable } from "stream";
import { finished } from "stream/promises";
import fs, { existsSync } from "fs";
import { ReadableStream } from "stream/web";
import { workspace } from "vscode";
import { Logger } from "../Logger";

export const ANDROID_FAIL_ERROR_MESSAGE = "Android failed.";
export const IOS_FAIL_ERROR_MESSAGE = "IOS failed.";

export function getDevServerScriptUrl() {
  return process.env.DEV_SCRIPT_URL;
}

export function isWorkspaceRoot(dir: string) {
  const packageJsonPath = path.join(dir, "package.json");
  let workspaces;
  try {
    workspaces = require(packageJsonPath).workspaces;
  } catch (e) {
    // No package.json
    return false;
  }

  if (workspaces) {
    return true;
  }

  return false;
}

export async function findFilesInWorkspace(fileGlobPattern: string, excludePattern: string | null) {
  const files = await workspace.findFiles(fileGlobPattern, excludePattern);
  if (files.length > 1) {
    Logger.warn(`Found multiple ${fileGlobPattern} files in the workspace`);
  }
  return files;
}

export enum ABI {
  ARMV8 = "arm64-v8a",
  X86 = "x86",
  X86_64 = "x86_64",
}

export function getNativeABI() {
  switch (process.arch) {
    case "x64":
      return ABI.X86_64;
    case "ia32":
      return ABI.X86;
    default:
      return ABI.ARMV8;
  }
}

export function getOldAppCachesDir() {
  return join(os.homedir(), "Library", "Caches", "com.swmansion.react-native-ide");
}

export function getAppCachesDir() {
  // this one is tricky to rename as Android emulators keep absolute path in config files
  return join(os.homedir(), "Library", "Caches", "com.swmansion.radon-ide");
}

export function getLogsDir() {
  return join(getAppCachesDir(), "Logs");
}

export function getOrCreateAppDownloadsDir() {
  const downloadsDirLocation = join(getAppCachesDir(), "Downloads");
  if (!fs.existsSync(downloadsDirLocation)) {
    fs.mkdirSync(downloadsDirLocation, { recursive: true });
  }
  return downloadsDirLocation;
}

export function isDeviceIOS(deviceId: string) {
  return deviceId.startsWith("ios");
}

export async function tryAcquiringLock(pidFilePath: string) {
  const currentPid = process.pid;
  const status = await pidFileStatus(pidFilePath);

  if (status === PidFileStatus.OWNED_BY_OTHER_PROCESS) {
    return false;
  }
  if (status !== PidFileStatus.OWNED_BY_CURRENT_PROCESS) {
    fs.writeFileSync(pidFilePath, currentPid.toString());
  }
  return true;
}

enum PidFileStatus {
  NO_FILE,
  STALE,
  OWNED_BY_OTHER_PROCESS,
  OWNED_BY_CURRENT_PROCESS,
}

async function pidFileStatus(pidFilePath: string) {
  if (!(await exists(pidFilePath))) {
    return PidFileStatus.NO_FILE;
  }

  const currentPid = process.pid;
  const contents = await readFile(pidFilePath);
  const maybeRunningPid = parseInt(contents, 10);

  if (maybeRunningPid === currentPid) {
    return PidFileStatus.OWNED_BY_CURRENT_PROCESS;
  }

  const isRunning = isPidRunning(maybeRunningPid);
  if (isRunning) {
    return PidFileStatus.OWNED_BY_OTHER_PROCESS;
  }
  return PidFileStatus.STALE;
}

function exists(filePath: string) {
  return new Promise<boolean>((resolve, reject) => {
    fs.stat(filePath, (err, _stats) => {
      if (err === null) {
        resolve(true);
      } else if (err.code === "ENOENT") {
        resolve(false);
      } else {
        reject(err);
      }
    });
  });
}

function readFile(filePath: string) {
  return new Promise<string>((resolve, reject) => {
    fs.readFile(filePath, (err, data) => {
      if (err) {
        reject(err);
      }
      resolve(data.toString());
    });
  });
}

function isPidRunning(pid: number) {
  try {
    // Signal 0 - special case for checking if process exists
    // https://nodejs.org/api/process.html#process_process_kill_pid_signal
    process.kill(pid, 0);
    return true;
  } catch (_e) {
    return false;
  }
}

async function calculateFileMD5(filePath: string, hash: Hash) {
  const BUFFER_SIZE = 8192;
  const fd = fs.openSync(filePath, "r");
  const buffer = new Uint8Array(BUFFER_SIZE);

  try {
    let bytesRead;

    do {
      bytesRead = fs.readSync(fd, buffer, 0, BUFFER_SIZE, null);
      hash.update(buffer.subarray(0, bytesRead));
    } while (bytesRead === BUFFER_SIZE);
  } finally {
    fs.closeSync(fd);
  }

  return hash;
}

export async function calculateMD5(fsPath: string, hash: Hash = createHash("md5")) {
  const stat = await fs.promises.stat(fsPath);
  if (stat.isFile()) {
    return calculateFileMD5(fsPath, hash);
  }

  const files = await fs.promises.readdir(fsPath);

  for await (let file of files) {
    let filePath = join(fsPath, file);
    const fileStat = await fs.promises.stat(filePath);

    if (fileStat.isDirectory()) {
      hash = await calculateMD5(filePath, hash);
    } else {
      hash = await calculateFileMD5(filePath, hash);
    }
  }
  return hash;
}
