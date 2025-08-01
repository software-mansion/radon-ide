import * as vscode from "vscode";
import { EditorType, ImageContent, TextContent, ToolResponse } from "./models";

export const MCP_LOG = "[MCP]";

export function getEditorType(): EditorType {
  // Cursor features different settings than VSCode
  const config = vscode.workspace.getConfiguration();
  if (config.get("cursor") !== undefined) {
    return EditorType.CURSOR;
  }
  return EditorType.VSCODE;
}

export function base64ToToolContent(data: string): ImageContent {
  return {
    type: "image",
    data,
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

export const truncateMiddle = (
  lines: string[],
  keepFirstN: number,
  keepLastN: number
): string[] => {
  const keepTotal = keepFirstN + keepLastN;

  if (lines.length <= keepTotal) {
    return lines;
  } else {
    const removedLinesOfLogs = lines.length - keepTotal;
    return [
      ...lines.slice(keepFirstN),
      `\n...\n\n[SKIPPED ${removedLinesOfLogs} LINES OF LOGS]\n\n...\n`,
      ...lines.slice(-keepLastN),
    ];
  }
};
