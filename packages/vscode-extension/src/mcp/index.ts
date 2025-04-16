// This module configures the MCP files for Cursor and VSCode

import fs from "fs";
import * as vscode from "vscode";
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
  let filePath = "";

  if (editorType === EditorType.CURSOR) {
    Logger.info(`Writing MCP config to ${CURSOR_FILE_PATH}`);
    filePath = CURSOR_FILE_PATH;
  } else if (editorType === EditorType.VSCODE) {
    Logger.info(`Writing MCP config to ${VSCODE_FILE_PATH}`);
    filePath = VSCODE_FILE_PATH;
  } else {
    // Unknown editors will not be handled, as mcp.json is not standardized yet.
    Logger.error(`Failed writing MCP config - unknown editor detected.`);
    return;
  }

  if (vscode.workspace.workspaceFolders?.length === 0) {
    Logger.error(`Failed writing MCP config - no workspace folder available.`);
    return;
  }

  const folder = vscode.workspace.workspaceFolders?.[0];

  if (!folder) {
    Logger.error(`Failed writing MCP config - no workspace folder open.`);
    return;
  }

  const jsonString = JSON.stringify(config, null, 2);

  fs.writeFile(filePath, jsonString, (err) => {
    if (err) {
      Logger.error(`Failed writing MCP config - error: ${err}`);
    }
  });
}

function newMcpConfig(jwtToken: string): McpConfig {
  const editorType = getEditorType();

  const radonMcpEntry = {
    RadonAi: {
      url: MCP_BACKEND_URL,
      type: "sse",
      headers: {
        // this doesn't work for now due to a Cursor bug,
        // said bug should be fixed with the next Cursor version
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
