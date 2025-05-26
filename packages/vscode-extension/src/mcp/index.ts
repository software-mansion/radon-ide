// This module configures the MCP files for Cursor and VSCode

import fs from "node:fs/promises";
import path from "node:path";
import * as vscode from "vscode";
import { Logger } from "../Logger";

enum EditorType {
  CURSOR = "cursor",
  VSCODE = "vscode",
}

type McpConfig = {
  mcpServers?: { RadonAi?: Object }; // cursor
  servers?: { RadonAi?: Object }; // vscode
};

const VSCODE_DIR_PATH = ".vscode";
const CURSOR_DIR_PATH = ".cursor";
const MCP_FILE_NAME = "mcp.json";
const MCP_BACKEND_URL = "https://radon-ai-backend.swmansion.com/sse";

function getEditorType(): EditorType {
  // heurestics, major == 0 means Cursor
  // found no better way of determining editor type
  if (vscode.version[0] === "0") {
    return EditorType.CURSOR;
  }
  return EditorType.VSCODE;
}

async function readMcpConfig(): Promise<McpConfig> {
  return new Promise((resolve, reject) => {
    const editorType = getEditorType();
    let filePath = "";

    if (editorType === EditorType.CURSOR) {
      filePath = path.join(CURSOR_DIR_PATH, MCP_FILE_NAME);
    } else if (editorType === EditorType.VSCODE) {
      filePath = path.join(VSCODE_DIR_PATH, MCP_FILE_NAME);
    } else {
      // Unknown editors will not be handled, as mcp.json is not standardized yet.
      Logger.error(`Couldn't read MCP config - unknown editor detected.`);
      reject();
    }

    Logger.info(`Reading MCP config at ${filePath}`);

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

async function writeMcpConfig(config: McpConfig) {
  const editorType = getEditorType();
  let directoryPath = "";

  if (editorType === EditorType.CURSOR) {
    directoryPath = path.join(CURSOR_DIR_PATH);
  } else if (editorType === EditorType.VSCODE) {
    directoryPath = path.join(VSCODE_DIR_PATH);
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

  const fsDirPath = path.join(folder.uri.fsPath, directoryPath);
  const fsPath = path.join(fsDirPath, MCP_FILE_NAME);

  try {
    await fs.mkdir(fsDirPath);
    Logger.info(`MCP config info - Creating ${directoryPath} directory.`);
  } catch {
    // no-op - dir already exists
    Logger.info(`MCP config info - Directory ${directoryPath} found.`);
  }

  fs.writeFile(fsPath, jsonString).catch((err) => {
    if (err) {
      Logger.error(`Failed writing MCP config - ${err}`);
    }
  });
}

async function insertRadonEntry(incompleteConfig: McpConfig): Promise<boolean> {
  if (incompleteConfig.servers?.RadonAi || incompleteConfig.mcpServers?.RadonAi) {
    Logger.info(`Valid MCP config already present.`);
    return false;
  }

  const radonMcpEntry = {
    url: MCP_BACKEND_URL,
    type: "sse",
    headers: {
      Authorization: "Bearer ${command:RNIDE.getLicenseToken}",
    },
  };

  if (incompleteConfig.servers) {
    incompleteConfig.servers.RadonAi = radonMcpEntry;
    return true;
  } else if (incompleteConfig.mcpServers) {
    incompleteConfig.mcpServers.RadonAi = radonMcpEntry;
    return true;
  }

  // mcp.json file has to have either 'servers' or 'mcpServers' field, otherwise it's invalid
  Logger.error(`Failed updating MCP config - existing mcp.json file is corrupted.`);
  return false;
}

function newMcpConfig(): McpConfig {
  const editorType = getEditorType();

  if (editorType === EditorType.VSCODE) {
    return {
      servers: {},
    };
  }

  return {
    mcpServers: {},
  };
}

export async function updateMcpConfig() {
  let mcpConfig = {};

  try {
    mcpConfig = await readMcpConfig();
  } catch {
    mcpConfig = newMcpConfig();
  }

  if (await insertRadonEntry(mcpConfig)) {
    writeMcpConfig(mcpConfig);
  }
}
