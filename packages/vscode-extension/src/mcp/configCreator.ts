import { EditorType, McpEntry } from "./models";
import { getEditorType } from "./utils";

// jsonc-parser by default builds a UMD bundle that esbuild can't resolve.
const { applyEdits, modify }: typeof import("jsonc-parser/lib/esm/main") = require("jsonc-parser");

export function insertRadonEntry(incompleteConfig: string, port: number): string {
  const rootKey = getEditorType() === EditorType.VSCODE ? "servers" : "mcpServers";
  const entryKey = "RadonAi";
  const radonMcpEntry: McpEntry = {
    url: `http://localhost:${port}/sse` as const,
    type: "sse" as const,
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
