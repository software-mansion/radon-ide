import fs from "node:fs/promises";
import path from "path";
import * as vscode from "vscode";
import { Logger } from "../Logger";
import { getTelemetryReporter } from "../utilities/telemetry";
import { EditorType, McpConfig } from "./models";
import { getEditorType, MCP_LOG } from "./utils";

const VSCODE_DIR_PATH = ".vscode";
const CURSOR_DIR_PATH = ".cursor";
const MCP_FILE_NAME = "mcp.json";

export async function readMcpConfig(): Promise<McpConfig> {
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

export async function writeMcpConfig(config: McpConfig) {
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
