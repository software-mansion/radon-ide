// This module configures the MCP files for Cursor and VSCode

import { Logger } from "../Logger";

enum EditorType {
  CURSOR = "cursor",
  VSCODE = "vscode",
}

interface CursorMcpConfig {
  mcpServers: Record<string, Object | string>;
}

interface VscodeMcpConfig {
  servers: Record<string, Object | string>;
}

type McpConfig = CursorMcpConfig | VscodeMcpConfig;

const VSCODE_FILE_PATH = ".vscode/mcp.json";
const CURSOR_FILE_PATH = ".cursor/mcp.json";
const MCP_BACKEND_URL = "https://radon-ai-backend.swmansion.com/sse";

function getEditorType(): EditorType {
  const editorType = EditorType.CURSOR;
  return editorType;
}

function readMcpConfig(): McpConfig | null {
  return null;
}

function writeMcpConfig(config: McpConfig) {
  const editorType = getEditorType();

  if (editorType === EditorType.CURSOR) {
    Logger.info(`Writing to ${CURSOR_FILE_PATH}`);
  } else if (editorType === EditorType.VSCODE) {
    Logger.info(`Writing to ${VSCODE_FILE_PATH}`);
  }

  // Cannot have a default case here, as using invalid schema usually results in red errors being thrown.
}

function newMcpConfig(jwtToken: string): McpConfig {
  const editorType = getEditorType();

  const radonMcpEntry = {
    RadonAi: {
      url: MCP_BACKEND_URL,
      type: "sse",
      headers: {
        Authorization: `Bearer ${jwtToken}`,
      },
    },
  };

  if (editorType === EditorType.VSCODE) {
    return {
      servers: radonMcpEntry,
    };
  }

  return {
    mcpServers: radonMcpEntry,
  };
}

export function updateMcpConfig(jwtToken: string) {
  let mcpConfig = readMcpConfig();

  // todo: keep track of config changes, exit if none are detected

  if (!mcpConfig) {
    mcpConfig = newMcpConfig(jwtToken);
  }

  writeMcpConfig(mcpConfig);
}
