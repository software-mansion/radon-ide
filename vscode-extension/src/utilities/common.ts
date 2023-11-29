import { workspace } from "vscode";

export function isDev() {
  return process.env.ENVIRONMENT === "DEVELOPMENT";
}

export function getDevServerScriptUrl() {
  return process.env.DEV_SCRIPT_URL;
}

export function getWorkspacePath() {
  return workspace.workspaceFolders?.[0]?.uri?.fsPath ?? "";
}
