import * as vscode from "vscode";
import { EditorType, ImageContent, TextContent, ToolResponse } from "./models";

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

export function pngToToolContent(base64Encoded: string): ImageContent {
  return {
    type: "image",
    data: base64Encoded,
    mimeType: "image/png",
  };
}

export function textToToolContent(text: string): TextContent {
  return {
    type: "text",
    text,
  };
}

export function textToToolResponse(text: string): ToolResponse {
  return {
    content: [textToToolContent(text)],
  };
}
