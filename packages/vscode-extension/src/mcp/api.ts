import { Logger } from "../Logger";
import { getLicenseToken } from "../utilities/license";
import { ToolResponse, ToolResult, ToolsInfo } from "./models";

const BACKEND_URL = "http://localhost:8000/"; // "https://radon-ai-backend.swmansion.com/api/";

export async function callTool(toolName: string, args: unknown): ToolResponse {
  // this function is similar to `chat:invokeToolCall()`, could merge them in the future
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

    if (!response.ok) {
      // network error is not accurate, as the tool call might've been malformed by the agent
      return "Failed tool call.";
    }

    const results: ToolResult = await response.json();

    if (results.tool_results.length === 0) {
      return "Tool response empty.";
    }

    const toolResults: string = results.tool_results[0].content;

    return toolResults;
  } catch {
    return "Failed tool call.";
  }
}

export async function getToolSchema(): Promise<ToolsInfo> {
  try {
    const url = new URL("/api/get_tool_schema/", BACKEND_URL);
    const resp = await fetch(url);

    if (!resp.ok) {
      Logger.error("Network error while fetching tool schema.");
      return {
        tools: [],
      };
    }

    return resp.json();
  } catch {
    Logger.error("Failed fetching tool schema.");
    return {
      tools: [],
    };
  }
}
