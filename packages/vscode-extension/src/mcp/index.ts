// This module configures the MCP files for Cursor and VSCode

import fs from "node:fs/promises";
import path from "node:path";
import * as vscode from "vscode";
import { Logger } from "../Logger";

enum EditorType {
  CURSOR = "cursor",
  VSCODE = "vscode",
}

type InnerMcpEntries = { RadonAi?: object; RadonAiLocal?: object };

type McpConfig = {
  mcpServers?: InnerMcpEntries; // cursor
  servers?: InnerMcpEntries; // vscode
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
    const folders = vscode.workspace.workspaceFolders;

    if (!folders || folders.length === 0) {
      Logger.error(`Couldn't read MCP config - no workspace folder available.`);
      reject();
      return;
    }

    const folder = folders[0];
    const editorType = getEditorType();
    let filePath = "";

    if (editorType === EditorType.CURSOR) {
      filePath = path.join(folder.uri.fsPath, CURSOR_DIR_PATH, MCP_FILE_NAME);
    } else if (editorType === EditorType.VSCODE) {
      filePath = path.join(folder.uri.fsPath, VSCODE_DIR_PATH, MCP_FILE_NAME);
    } else {
      // Unknown editors will not be handled, as mcp.json is not standardized yet.
      Logger.error(`Couldn't read MCP config - unknown editor detected.`);
      reject();
    }

    Logger.info(`Reading MCP config at ${filePath}`);

    fs.readFile(filePath, { encoding: "utf8" })
      .then((data) => {
        const config = JSON.parse(data);
        Logger.info(`Found valid MCP config - updating.`);
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

  await fs.mkdir(fsDirPath, { recursive: true });

  fs.writeFile(fsPath, jsonString)
    .then(() => {
      Logger.info(`Wrote updated MCP config successfully.`);
    })
    .catch((err) => {
      if (err) {
        Logger.error(`Failed writing MCP config - ${err}`);
      }
    });
}

async function insertRadonEntry(incompleteConfig: McpConfig, port: number): Promise<boolean> {
  const radonMcpEntry = {
    url: MCP_BACKEND_URL,
    type: "sse",
    headers: {
      Authorization: "Bearer ${command:RNIDE.getLicenseToken}",
    },
  };

  const radonMcpLocalEntry = {
    url: `http://localhost:${port}/sse`,
    type: "sse",
  };

  if (incompleteConfig.servers) {
    incompleteConfig.servers.RadonAi = radonMcpEntry;
    incompleteConfig.servers.RadonAiLocal = radonMcpLocalEntry;
    return true;
  } else if (incompleteConfig.mcpServers) {
    incompleteConfig.mcpServers.RadonAi = radonMcpEntry;
    incompleteConfig.mcpServers.RadonAiLocal = radonMcpLocalEntry;
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

export async function updateMcpConfig(port: number) {
  let mcpConfig = {};

  try {
    mcpConfig = await readMcpConfig();
  } catch {
    mcpConfig = newMcpConfig();
  }

  if (await insertRadonEntry(mcpConfig, port)) {
    writeMcpConfig(mcpConfig);
  }
}
