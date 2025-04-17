// This module configures the MCP files for Cursor and VSCode

import fs from "node:fs/promises";
import path from "node:path";
import * as vscode from "vscode";
import { Logger } from "../Logger";
import { getLicenseToken } from "../utilities/license";

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

async function readMcpConfig(): Promise<McpConfig> {
  return new Promise((resolve, reject) => {
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
      Logger.error(`Couldn't read MCP config - unknown editor detected.`);
      reject();
    }

    if (vscode.workspace.workspaceFolders?.length === 0) {
      Logger.error(`Couldn't read MCP config - no workspace folder available.`);
      reject();
    }

    const folder = vscode.workspace.workspaceFolders?.[0];

    if (!folder) {
      Logger.error(`Couldn't read MCP config - no workspace folder open.`);
      reject();
    }

    // todo: handle lack of mcp.json separately

    fs.readFile(filePath, { encoding: "utf8" })
      .then((data) => {
        const config = JSON.parse(data);
        resolve(config);
      })
      .catch(() => {
        Logger.info(`Couldn't read MCP config - MCP config not found.`);
        reject();
      });
  });
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

  const fsPath = path.join(folder.uri.fsPath, filePath);

  fs.writeFile(fsPath, jsonString).catch((err) => {
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

export async function updateMcpConfig() {
  let mcpConfig = await readMcpConfig();

  // todo: keep track of config changes, exit if none are detected

  if (!mcpConfig) {
    const jwt = await getLicenseToken();
    if (!jwt) {
      Logger.error(`Failed updating MCP config - no JWT token available.`);
      return;
    }
    mcpConfig = newMcpConfig(jwt);
  }

  writeMcpConfig(mcpConfig);
}
