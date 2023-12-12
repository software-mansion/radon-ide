import { workspace } from "vscode";
import os from "os";
import path from "path";
import fs from "fs";
import { getUri } from "./getUri";
import { Logger } from "../Logger";
import { execWithLog } from "./subprocess";

export function isDev() {
  return process.env.ENVIRONMENT === "DEVELOPMENT";
}

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
      return "x86_64";
    default:
      return "arm64-v8a";
  }
}

export function getAppCachesDir() {
  return path.join(os.homedir(), "Library", "Caches", "com.swmansion.react-native-preview-vscode");
}

export function getLogsDir() {
  return path.join(getAppCachesDir(), "Logs");
}

export function dumpLogsToFile(error?: Error | any) {
  const logsDir = getLogsDir();
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir);
  }

  const logDate = new Date();
  const fileName = `logs-${logDate
    .toLocaleDateString()
    .replace(/\//g, "-")}-${logDate.toLocaleTimeString()}`;
  const stackTrace = error?.stack;
  const fileContent = Logger.getMessageArchives().join("\n") + "\n" + stackTrace;
  fs.writeFileSync(path.join(logsDir, fileName), fileContent);
}

export function openLocationInFinder(location: string) {
  execWithLog(`open ${getLogsDir()}`);
}
