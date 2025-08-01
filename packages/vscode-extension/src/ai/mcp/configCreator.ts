import { randomUUID } from "node:crypto";
import { EditorType, McpEntry } from "./models";
import { getEditorType } from "./utils";

// jsonc-parser by default builds a UMD bundle that esbuild can't resolve.
const { applyEdits, modify }: typeof import("jsonc-parser/lib/esm/main") = require("jsonc-parser");

const CURSOR_KEY = "mcpServers";
const VSCODE_KEY = "servers";

export function insertRadonEntry(incompleteConfig: string, port: number): string {
  const rootKey = getEditorType() === EditorType.VSCODE ? VSCODE_KEY : CURSOR_KEY;
  const entryKey = "RadonAi";
  const radonMcpEntry: McpEntry = {
    url: `http://127.0.0.1:${port}/mcp` as const,
    type: "http" as const,
    headers: {
      nonce: randomUUID(),
    },
  };

  try {
    const edits = modify(incompleteConfig, [rootKey, entryKey], radonMcpEntry, {
      formattingOptions: { insertSpaces: true, tabSize: 2 },
    });
    const config = applyEdits(incompleteConfig, edits);
    return config;
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
