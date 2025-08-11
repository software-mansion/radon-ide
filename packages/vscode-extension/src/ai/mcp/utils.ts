import * as vscode from "vscode";
import { EditorType, ToolResponse } from "./models";

export const MCP_LOG = "[MCP]";

export enum ConfigLocation {
  Project = "Project",
  Global = "Global",
}

export function getConfigLocation(): ConfigLocation {
  const configuration = vscode.workspace.getConfiguration("RadonIDE");
  return configuration.get<ConfigLocation>("locationOfMcpConfig") ?? ConfigLocation.Project;
}

export function getEditorType(): EditorType {
  // Cursor features different settings than VSCode
  const config = vscode.workspace.getConfiguration();
  if (config.get("cursor") !== undefined) {
    return EditorType.CURSOR;
  }
  return EditorType.VSCODE;
}

export function textToToolResponse(text: string): ToolResponse {
  return {
    content: [
      {
        type: "text",
        text,
      },
    ],
  };
}
