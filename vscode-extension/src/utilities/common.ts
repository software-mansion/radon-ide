import { workspace } from "vscode";
import os from "os";
import { createHash, Hash } from "crypto";
import { join, extname } from "path";
import { Readable } from "stream";
import { finished } from "stream/promises";
import fs from "fs";
import { ReadableStream } from "stream/web";

export enum CPU_ARCHITECTURE {
  ARM64 = "arm64-v8a",
  X64 = "x86_64",
}

export const ANDROID_FAIL_ERROR_MESSAGE = "Android failed.";
export const IOS_FAIL_ERROR_MESSAGE = "IOS failed.";

export function getDevServerScriptUrl() {
  return process.env.DEV_SCRIPT_URL;
}

export function getWorkspacePath() {
  return workspace.workspaceFolders?.[0]?.uri?.fsPath ?? "";
}

export function getCpuArchitecture() {
  const arch = os.arch();
  switch (arch) {
    case "x64":
    case "ia32":
      return CPU_ARCHITECTURE.X64;
    default:
      return CPU_ARCHITECTURE.ARM64;
  }
}

export function getAppCachesDir() {
  return join(os.homedir(), "Library", "Caches", "com.swmansion.react-native-ide");
}

export function getLogsDir() {
  return join(getAppCachesDir(), "Logs");
}

export function isDeviceIOS(deviceId: string) {
  return deviceId.startsWith("ios");
}

export async function downdloadFile(url: string, destination: string) {
  const stream = fs.createWriteStream(destination);
  const { body } = await fetch(url);
  if (!body) {
    throw new Error(`Unexpected error during the file download from ${url}.`);
  }
  await finished(Readable.fromWeb(body as ReadableStream).pipe(stream));
}

async function calculateFileMD5(filePath: string, hash: Hash) {
  const BUFFER_SIZE = 8192;
  const fd = fs.openSync(filePath, "r");
  const buffer = Buffer.alloc(BUFFER_SIZE);

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

export async function calculateMD5(path: string, hash: Hash = createHash("md5")) {
  const stat = await fs.promises.stat(path);
  if (stat.isFile()) {
    return calculateFileMD5(path, hash);
  }

  const files = await fs.promises.readdir(path);

  for await (let file of files) {
    let filePath = join(path, file);
    const stat = await fs.promises.stat(filePath);

    if (stat.isDirectory()) {
      hash = await calculateMD5(filePath, hash);
    } else {
      hash = await calculateFileMD5(filePath, hash);
    }
  }
  return hash;
}

export function findFileWithExtension(files: string[], extension: string) {
  return files.find((file) => extname(file) === extension);
}
