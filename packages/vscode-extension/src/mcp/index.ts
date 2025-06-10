// This module configures the MCP files for Cursor and VSCode

import fs from "node:fs/promises";
import path from "node:path";
import * as vscode from "vscode";
import { Logger } from "../Logger";
import { getTelemetryReporter } from "../utilities/telemetry";
import { EditorType, McpConfig } from "./models";
import { getOpenPort } from "../utilities/common";
import { startLocalMcpServer } from "./server";

const MCP_LOG = "[MCP]";

const VSCODE_DIR_PATH = ".vscode";
const CURSOR_DIR_PATH = ".cursor";
const MCP_FILE_NAME = "mcp.json";

function getEditorType(): EditorType {
  // Cursor features different settings than VSCode
  const config = vscode.workspace.getConfiguration();
  if (config.get("cursor") !== undefined) {
    return EditorType.CURSOR;
  }
  return EditorType.VSCODE;
}

async function readMcpConfig(): Promise<McpConfig> {
  const folders = vscode.workspace.workspaceFolders;

  if (!folders || folders.length === 0) {
    // This is an expected warning, don't report via telemetry.
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
    let msg = `Couldn't read MCP config - unknown editor detected.`;
    Logger.error(MCP_LOG, msg);
    getTelemetryReporter().sendTelemetryEvent("mcp:error", { error: msg });
    throw new Error(msg);
  }

  Logger.info(MCP_LOG, `Reading MCP config at ${filePath}`);

  try {
    return await fs.readFile(filePath, { encoding: "utf8" }).then((data) => {
      const config = JSON.parse(data);
      Logger.info(MCP_LOG, `Found valid MCP config - updating.`);
      return config;
    });
  } catch {
    // This is an expected warning, don't report via telemetry.
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
    let msg = `Failed writing MCP config - unknown editor detected`;
    Logger.error(MCP_LOG, msg);
    getTelemetryReporter().sendTelemetryEvent("mcp:error", { error: msg });
    return;
  }

  if (vscode.workspace.workspaceFolders?.length === 0) {
    let msg = `Failed writing MCP config - no workspace folder available`;
    Logger.error(MCP_LOG, msg);
    getTelemetryReporter().sendTelemetryEvent("mcp:error", { error: msg });
    return;
  }

  const folder = vscode.workspace.workspaceFolders?.[0];

  if (!folder) {
    let msg = `Failed writing MCP config - no workspace folder open`;
    Logger.error(MCP_LOG, msg);
    getTelemetryReporter().sendTelemetryEvent("mcp:error", { error: msg });
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
    .catch((error) => {
      if (error) {
        let msg = `Failed writing MCP config: ${error instanceof Error ? error.message : String(error)}`;
        Logger.error(MCP_LOG, msg);
        getTelemetryReporter().sendTelemetryEvent("mcp:error", { error: msg });
      }
    });
}

export async function insertRadonEntry(incompleteConfig: McpConfig, port: number) {
  const radonMcpEntry = {
    url: `http://localhost:${port}/sse` as const,
    type: "sse" as const,
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

async function updateMcpConfig(port: number) {
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
    let msg = error instanceof Error ? error.message : String(error);
    Logger.error(MCP_LOG, msg);
    getTelemetryReporter().sendTelemetryEvent("mcp:error", { error: msg });
  }
}

let mcpPort: number | null = null;

export default async function loadRadonAi() {
  if (mcpPort !== null) {
    return mcpPort;
  }

  try {
    mcpPort = await getOpenPort();

    await startLocalMcpServer(mcpPort);

    // Enables Radon AI tooling on editors utilizing mcp.json configs.
    await updateMcpConfig(mcpPort);

    getTelemetryReporter().sendTelemetryEvent("mcp:started");
  } catch (error) {
    let msg = `Failed initializing MCP with error: ${error instanceof Error ? error.message : String(error)}`;
    Logger.error(MCP_LOG, msg);
    getTelemetryReporter().sendTelemetryEvent("mcp:error", { error: msg });
  }
}
