import { EditorType, getEditorType } from "../../utilities/editorType";

// jsonc-parser by default builds a UMD bundle that esbuild can't resolve.
const { applyEdits, modify }: typeof import("jsonc-parser/lib/esm/main") = require("jsonc-parser");

const CURSOR_KEY = "mcpServers";
const VSCODE_KEY = "servers";
export const ENTRY_KEY = "RadonAI";
const OLD_ENTRY_KEY = "RadonAi";

export function insertRadonEntry(config: string): string | undefined {
  const rootKey = getEditorType() === EditorType.VSCODE ? VSCODE_KEY : CURSOR_KEY;
  // In order to test the development version of the MCP server:
  // 1) Run  `npm run build` in the `packages/radon-mcp` directory
  // 2) update the `radonMcpEntry` to the following:
  // {
  //   command: "node",
  //   args: [
  //     path.join(extensionContext.extensionPath, "../packages/radon-mcp/dist/index.js"),
  //     "${workspaceFolder}",
  //   ],
  // };
  const radonMcpEntry = {
    command: "npx",
    args: ["-y", "radon-mcp@latest", "${workspaceFolder}"],
  };

  try {
    const edits = modify(config, [rootKey, ENTRY_KEY], radonMcpEntry, {
      formattingOptions: { insertSpaces: true, tabSize: 2 },
    });
    const newConfig = applyEdits(config, edits);
    if (newConfig === config) {
      return undefined;
    } else {
      return newConfig;
    }
  } catch {
    // mcp.json syntax error
    throw new Error(`Failed updating MCP config - existing mcp.json file is corrupted.`);
  }
}

export function removeRadonEntry(config: string): string | undefined {
  const rootKey = getEditorType() === EditorType.VSCODE ? VSCODE_KEY : CURSOR_KEY;

  try {
    const edits = modify(config, [rootKey, ENTRY_KEY], undefined, {
      formattingOptions: { insertSpaces: true, tabSize: 2 },
    });
    if (edits.length === 0) {
      return undefined;
    } else {
      return applyEdits(config, edits);
    }
  } catch {
    // mcp.json syntax error
    throw new Error(`Failed updating MCP config - existing mcp.json file is corrupted.`);
  }
}

export function removeOldRadonEntry(config: string): string | undefined {
  const rootKey = getEditorType() === EditorType.VSCODE ? VSCODE_KEY : CURSOR_KEY;

  try {
    const edits = modify(config, [rootKey, OLD_ENTRY_KEY], undefined, {
      formattingOptions: { insertSpaces: true, tabSize: 2 },
    });
    if (edits.length === 0) {
      return undefined;
    } else {
      return applyEdits(config, edits);
    }
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
