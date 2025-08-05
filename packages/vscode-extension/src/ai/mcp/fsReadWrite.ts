import fs from "node:fs/promises";
import path from "path";
import * as os from "os";
import * as vscode from "vscode";
import { Logger } from "../../Logger";
import { getTelemetryReporter } from "../../utilities/telemetry";
import { EditorType } from "./models";
import { ConfigLocation, getEditorType, MCP_LOG } from "./utils";

const VSCODE_DIR_PATH = ".vscode";
const CURSOR_DIR_PATH = ".cursor";
const MCP_FILE_NAME = "mcp.json";

function getMcpConfigDirPath(location: ConfigLocation): string {
  const folders = vscode.workspace.workspaceFolders;

  if (!folders || folders.length === 0) {
    // This is an expected warning, don't report via telemetry.
    throw new Error(`Couldn't access MCP config - no workspace folder available.`);
  }

  let rootPath = "";

  if (location === ConfigLocation.Global) {
    rootPath = os.homedir();
  } else {
    rootPath = folders[0].uri.fsPath;
  }

  let filePath = "";
  const editorType = getEditorType();

  if (editorType === EditorType.CURSOR) {
    filePath = path.join(rootPath, CURSOR_DIR_PATH);
  } else if (editorType === EditorType.VSCODE) {
    filePath = path.join(rootPath, VSCODE_DIR_PATH);
  } else {
    // Unknown editors will not be handled, as mcp.json is not standardized yet.
    let msg = `Couldn't access MCP config - unknown editor detected.`;
    Logger.error(MCP_LOG, msg);
    getTelemetryReporter().sendTelemetryEvent("radon-ai:unknown-editor-error", { error: msg });
    throw new Error(msg);
  }

  return filePath;
}

export async function readMcpConfig(location: ConfigLocation): Promise<string | null> {
  let filePath = path.join(getMcpConfigDirPath(location), MCP_FILE_NAME);

  Logger.info(MCP_LOG, `Reading MCP config at ${filePath}`);

  try {
    return await fs.readFile(filePath, { encoding: "utf8" }).then((data) => {
      Logger.info(MCP_LOG, `Found valid MCP config - updating.`);
      return data;
    });
  } catch {
    // Config file not found - create new one.
    return null;
  }
}

export async function writeMcpConfig(configText: string, location: ConfigLocation) {
  const directoryPath = getMcpConfigDirPath(location);

  await fs.mkdir(directoryPath, { recursive: true });

  const fsPath = path.join(directoryPath, MCP_FILE_NAME);

  fs.writeFile(fsPath, configText)
    .then(() => {
      Logger.info(MCP_LOG, `Wrote updated MCP config successfully.`);
    })
    .catch((error) => {
      if (error) {
        let msg = `Failed writing MCP config: ${error instanceof Error ? error.message : String(error)}`;
        Logger.error(MCP_LOG, msg);
        getTelemetryReporter().sendTelemetryEvent("radon-ai:config-write-error", { error: msg });
      }
    });
}
