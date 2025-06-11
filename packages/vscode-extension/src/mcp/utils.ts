import * as vscode from "vscode";
import { EditorType } from "./models";

export const MCP_LOG = "[MCP]";

export function getEditorType(): EditorType {
  // Cursor features different settings than VSCode
  const config = vscode.workspace.getConfiguration();
  if (config.get("cursor") !== undefined) {
    return EditorType.CURSOR;
  }
  return EditorType.VSCODE;
}
