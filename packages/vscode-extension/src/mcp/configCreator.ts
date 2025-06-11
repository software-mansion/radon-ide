import { EditorType, McpConfig } from "./models";
import { getEditorType } from "./utils";

export function insertRadonEntry(incompleteConfig: McpConfig, port: number) {
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

export function newMcpConfig(): McpConfig {
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
