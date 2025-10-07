import { randomUUID } from "node:crypto";
import { McpEntry } from "./models";
import { EditorType, getEditorType } from "../../utilities/editorType";

// jsonc-parser by default builds a UMD bundle that esbuild can't resolve.
const { applyEdits, modify }: typeof import("jsonc-parser/lib/esm/main") = require("jsonc-parser");

const CURSOR_KEY = "mcpServers";
const VSCODE_KEY = "servers";
const ENTRY_KEY = "RadonAi";

export function insertRadonEntry(incompleteConfig: string, port: number): string {
  const rootKey = getEditorType() === EditorType.VSCODE ? VSCODE_KEY : CURSOR_KEY;
  const radonMcpEntry: McpEntry = {
    url: `http://127.0.0.1:${port}/mcp` as const,
    type: "http" as const,
    headers: {
      nonce: randomUUID(),
    },
  };

  try {
    const edits = modify(incompleteConfig, [rootKey, ENTRY_KEY], radonMcpEntry, {
      formattingOptions: { insertSpaces: true, tabSize: 2 },
    });
    const config = applyEdits(incompleteConfig, edits);
    return config;
  } catch {
    // mcp.json syntax error
    throw new Error(`Failed updating MCP config - existing mcp.json file is corrupted.`);
  }
}

export function removeRadonEntry(config: string): string {
  const rootKey = getEditorType() === EditorType.VSCODE ? VSCODE_KEY : CURSOR_KEY;

  try {
    const edits = modify(config, [rootKey, ENTRY_KEY], undefined, {
      formattingOptions: { insertSpaces: true, tabSize: 2 },
    });

    const newConfig = applyEdits(config, edits);

    return newConfig;
  } catch {
    // mcp.json syntax error
    throw new Error(`Failed updating MCP config - existing mcp.json file is corrupted.`);
  }
}

const vscodeConfig = JSON.stringify({ servers: {} });
const cursorConfig = JSON.stringify({ mcpServers: {} });

export function newMcpConfig(): string {
  return getEditorType() === EditorType.VSCODE ? vscodeConfig : cursorConfig;
}
