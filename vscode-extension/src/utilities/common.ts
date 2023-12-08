import { workspace } from "vscode";
import os from "os";
import path from "path";

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
