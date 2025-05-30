import { Logger } from "../Logger";
import { getLicenseToken } from "../utilities/license";
import { getTelemetryReporter } from "../utilities/telemetry";
import { ToolResponse, ToolResult, ToolsInfo } from "./models";

const BACKEND_URL = "https://radon-ai-backend.swmansion.com/api/";
const MCP_LOG = "[MCP]";

export async function invokeToolCall(toolName: string, args: unknown): ToolResponse {
  // this function is similar to `chat:invokeToolCall()`, will merge them in the future
  try {
    const url = new URL("/api/tool_calls/", BACKEND_URL);
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${getLicenseToken()}`,
      },
      body: JSON.stringify({
        tool_calls: [
          {
            name: toolName,
            id: "3241", // temporarily necessary placeholder
            args,
          },
        ],
      }),
    });

    if (response.status !== 200) {
      const msg = `Failed to fetch response from Radon AI with status: ${response.status}`;
      Logger.error(MCP_LOG, msg);
      getTelemetryReporter().sendTelemetryEvent("mcp:error", { error: msg });
      return "Failed tool call. Check for call format validity.";
    }

    const results: ToolResult = await response.json();

    if (results.tool_results.length === 0) {
      return "Tool response empty.";
    }

    return results.tool_results[0].content;
  } catch (error) {
    if (error instanceof Error) {
      const msg = `Failed tool call with error: ${error.message}`;
      getTelemetryReporter().sendTelemetryEvent("mcp:error", { error: error.message });
      Logger.error(MCP_LOG, msg);
      return msg;
    } else {
      const msg = `Failed tool call with error: ${String(error)}`;
      getTelemetryReporter().sendTelemetryEvent("mcp:error", { error: String(error) });
      Logger.error(MCP_LOG, msg);
      return msg;
    }
  }
}

export async function getToolSchema(): Promise<ToolsInfo> {
  try {
    const url = new URL("/api/get_tool_schema/", BACKEND_URL);
    const response = await fetch(url);

    if (response.status !== 200) {
      const msg = `Network error while fetching tool schema with status: ${response.status}`;
      Logger.error(MCP_LOG, msg);
      getTelemetryReporter().sendTelemetryEvent("mcp:error", { error: msg });
      return {
        tools: [],
      };
    }

    return response.json();
  } catch (error) {
    if (error instanceof Error) {
      const msg = `Failed fetching tool schema with error: ${error.message}`;
      Logger.error(MCP_LOG, msg);
      getTelemetryReporter().sendTelemetryEvent("mcp:error", { error: msg });
    } else {
      const msg = `Failed fetching tool schema with error: ${String(error)}`;
      Logger.error(MCP_LOG, msg);
      getTelemetryReporter().sendTelemetryEvent("mcp:error", { error: msg });
    }
    return {
      tools: [],
    };
  }
}
