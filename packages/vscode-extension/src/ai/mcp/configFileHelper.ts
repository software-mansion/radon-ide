import { Logger } from "../../Logger";
import { EditorType, getEditorType } from "../../utilities/editorType";
import { ConfigLocation, readMcpConfig, writeMcpConfig } from "./fsReadWrite";

// jsonc-parser by default builds a UMD bundle that esbuild can't resolve.
const {
  applyEdits,
  modify,
  parseTree,
  findNodeAtLocation,
  getNodeValue,
}: typeof import("jsonc-parser/lib/esm/main") = require("jsonc-parser");

const CURSOR_KEY = "mcpServers";
const VSCODE_KEY = "servers";
const OLD_ENTRY_KEY = "RadonAi";

export function cleanupOldMcpConfigEntries() {
  removeOldRadonEntry(ConfigLocation.Global);
  removeOldRadonEntry(ConfigLocation.Project);
}

async function removeOldRadonEntry(location: ConfigLocation) {
  try {
    const mcpConfig = await readMcpConfig(location);
    if (!mcpConfig) {
      return;
    }
    const updatedConfig = removeOldRadonEntryFromConfig(mcpConfig);
    if (updatedConfig) {
      await writeMcpConfig(updatedConfig, location);
    }
  } catch (error) {
    Logger.error("Failed removing old Radon entry from MCP config:", error);
  }
}

// exported for testing
export function removeOldRadonEntryFromConfig(config: string): string | undefined {
  // only remove the old Radon entry from mcp config if it points to http:// based server.
  // we now provide stdio based MCP server that people can optionally conifgure in their
  // mcp.json files and we don't want to remove that entry.
  const editorType = getEditorType();

  if (!(editorType in [EditorType.VSCODE, EditorType.CURSOR])) {
    // Other editor types are not supported yet,
    // and thus don't have entries that have to be removed.
    return;
  }

  const rootKey = editorType === EditorType.VSCODE ? VSCODE_KEY : CURSOR_KEY;

  const mcpConfigTree = parseTree(config);
  if (!mcpConfigTree) {
    return undefined;
  }
  const oldEntry = findNodeAtLocation(mcpConfigTree, [rootKey, OLD_ENTRY_KEY]);
  if (!oldEntry) {
    return undefined;
  }
  const oldEntryValue = getNodeValue(oldEntry);
  if (!oldEntryValue?.url?.startsWith("http://")) {
    return undefined;
  }
  const edits = modify(config, [rootKey, OLD_ENTRY_KEY], undefined, {
    formattingOptions: { insertSpaces: true, tabSize: 2 },
  });

  if (edits.length === 0) {
    return undefined;
  } else {
    return applyEdits(config, edits);
  }
}
