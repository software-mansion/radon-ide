import { workspace } from "vscode";

export enum EditorType {
  CURSOR = "cursor",
  VSCODE = "vscode",
}

export function getEditorType(): EditorType {
  // Cursor features different settings than VSCode
  const config = workspace.getConfiguration();
  if (config.get("cursor") !== undefined) {
    return EditorType.CURSOR;
  }
  return EditorType.VSCODE;
}
