// This module configures the MCP files for Cursor and VSCode

import fs from "node:fs/promises";
import path from "node:path";
import * as vscode from "vscode";
import { Logger } from "../Logger";
import { getTelemetryReporter } from "../utilities/telemetry";
import { EditorType, McpConfig } from "./models";

const MCP_LOG = "[MCP]";

const VSCODE_DIR_PATH = ".vscode";
const CURSOR_DIR_PATH = ".cursor";
const MCP_FILE_NAME = "mcp.json";

function getEditorType(): EditorType {
  // heurestics, major == 0 means Cursor
  // found no better way of determining editor type
  if (vscode.version[0] === "0") {
    return EditorType.CURSOR;
  }
  return EditorType.VSCODE;
}

async function readMcpConfig(): Promise<McpConfig> {
  const folders = vscode.workspace.workspaceFolders;

  if (!folders || folders.length === 0) {
    throw new Error(`Couldn't read MCP config - no workspace folder available.`);
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
    throw new Error(`Couldn't read MCP config - unknown editor detected.`);
  }

  Logger.info(MCP_LOG, `Reading MCP config at ${filePath}`);

  try {
    return await fs.readFile(filePath, { encoding: "utf8" }).then((data) => {
      const config = JSON.parse(data);
      Logger.info(MCP_LOG, `Found valid MCP config - updating.`);
      return config;
    });
  } catch {
    throw new Error(`Couldn't read MCP config - MCP config not found.`);
  }
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
    Logger.error(MCP_LOG, `Failed writing MCP config - unknown editor detected.`);
    return;
  }

  if (vscode.workspace.workspaceFolders?.length === 0) {
    Logger.error(MCP_LOG, `Failed writing MCP config - no workspace folder available.`);
    return;
  }

  const folder = vscode.workspace.workspaceFolders?.[0];

  if (!folder) {
    Logger.error(MCP_LOG, `Failed writing MCP config - no workspace folder open.`);
    return;
  }

  const jsonString = JSON.stringify(config, null, 2);

  const fsDirPath = path.join(folder.uri.fsPath, directoryPath);
  const fsPath = path.join(fsDirPath, MCP_FILE_NAME);

  await fs.mkdir(fsDirPath, { recursive: true });

  fs.writeFile(fsPath, jsonString)
    .then(() => {
      Logger.info(MCP_LOG, `Wrote updated MCP config successfully.`);
    })
    .catch((err) => {
      if (err) {
        Logger.error(MCP_LOG, `Failed writing MCP config - ${err}`);
      }
    });
}

async function insertRadonEntry(incompleteConfig: McpConfig, port: number) {
  const radonMcpEntry = {
    url: `http://localhost:${port}/sse`,
    type: "sse",
  };

  if (incompleteConfig.servers) {
    incompleteConfig.servers.RadonAi = radonMcpEntry;
    return;
  } else if (incompleteConfig.mcpServers) {
    incompleteConfig.mcpServers.RadonAi = radonMcpEntry;
    return;
  }

  // mcp.json file has to have either 'servers' or 'mcpServers' field, otherwise it's invalid
  throw new Error(`Failed updating MCP config - existing mcp.json file is corrupted.`);
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
  } catch (info) {
    if (info instanceof Error) {
      Logger.info(MCP_LOG, info.message);
    } else {
      Logger.info(MCP_LOG, String(info));
    }

    mcpConfig = newMcpConfig();
  }

  try {
    await insertRadonEntry(mcpConfig, port);
    await writeMcpConfig(mcpConfig);
  } catch (error) {
    if (error instanceof Error) {
      Logger.error(MCP_LOG, error.message);
      getTelemetryReporter().sendTelemetryEvent("chat:error", { error: error.message });
    } else {
      Logger.error(MCP_LOG, String(error));
      getTelemetryReporter().sendTelemetryEvent("chat:error", { error: String(error) });
    }
  }
}
