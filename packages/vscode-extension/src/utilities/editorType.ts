import { workspace } from "vscode";

export enum EditorType {
  CURSOR = "cursor",
  WINDSURF = "windsurf",
  ANTIGRAVITY = "antigravity", // Google's VSCode fork
  VSCODE = "vscode",
}

export function getEditorType(): EditorType {
  // Cursor features different settings than VSCode
  const config = workspace.getConfiguration();
  if (config.get("cursor") !== undefined) {
    return EditorType.CURSOR;
  } else if (config.get("windsurf") !== undefined) {
    return EditorType.WINDSURF;
  } else if (config.get("antigravity") !== undefined) {
    return EditorType.ANTIGRAVITY;
  }

  return EditorType.VSCODE;
}
