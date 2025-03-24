import { workspace } from "vscode";

export function isAutoSaveEnabled(): boolean {
  return workspace.getConfiguration().get("files.autoSave") !== "off";
}
