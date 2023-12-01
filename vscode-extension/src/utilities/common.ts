import { workspace } from "vscode";
import os from "os";

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
      "arm64-v8a";
  }
}
