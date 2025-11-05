import fs from "node:fs/promises";
import path from "path";
import * as os from "os";
import * as vscode from "vscode";
import { Logger } from "../../Logger";
import { EditorType, getEditorType } from "../../utilities/editorType";

const VSCODE_DIR_PATH = ".vscode";
const CURSOR_DIR_PATH = ".cursor";
const MCP_FILE_NAME = "mcp.json";

export enum ConfigLocation {
  Project = "Project",
  Global = "Global",
}

function getMcpConfigDirPath(location: ConfigLocation): string {
  let rootPath = "";

  if (location === ConfigLocation.Global) {
    rootPath = os.homedir();
  } else {
    const folders = vscode.workspace.workspaceFolders;

    if (!folders || folders.length === 0) {
      // This is an expected warning, don't report via telemetry.
      throw new Error(`Couldn't access MCP config - no workspace folder available.`);
    }

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
    throw new Error("Couldn't access MCP config - unknown editor detected");
  }

  return filePath;
}

export async function readMcpConfig(location: ConfigLocation): Promise<string | null> {
  try {
    let filePath = path.join(getMcpConfigDirPath(location), MCP_FILE_NAME);
    Logger.info(`Reading MCP config at ${filePath}`);
    return await fs.readFile(filePath, { encoding: "utf8" }).then((data) => {
      return data;
    });
  } catch {
    return null;
  }
}

export async function writeMcpConfig(configText: string, location: ConfigLocation) {
  const directoryPath = getMcpConfigDirPath(location);
  const fsPath = path.join(directoryPath, MCP_FILE_NAME);
  await fs.mkdir(directoryPath, { recursive: true });
  await fs.writeFile(fsPath, configText);
}
