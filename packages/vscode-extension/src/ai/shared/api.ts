import * as vscode from "vscode";
import { Logger } from "../../Logger";
import { getLicenseToken } from "../../utilities/license";
import { getTelemetryReporter } from "../../utilities/telemetry";
import { CHAT_LOG } from "../chat";
import { ToolResponse, ToolResult, ToolsInfo } from "../mcp/models";
import { textToToolResponse } from "../mcp/utils";
import { ConnectionListener } from "./ConnectionListener";

const BACKEND_URL = "https://radon-ai-backend.swmansion.com/api/";
const MCP_LOG = "[MCP]";

export async function invokeToolCall(
  toolName: string,
  args: unknown,
  id: string,
  connectionListener?: ConnectionListener
): Promise<ToolResponse> {
  getTelemetryReporter().sendTelemetryEvent("radon-ai:tool-called", { toolName });
  try {
    const url = new URL("/api/tool_calls/", BACKEND_URL);
    const token = await getLicenseToken();
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({
        tool_calls: [
          {
            name: toolName,
            id,
            args,
          },
        ],
      }),
    });

    if (response.status === 401) {
      throw Error(`Authorization failed when connecting to the backend.`);
    }

    if (response.status !== 200) {
      const isOnline = await isServerOnline();

      if (!isOnline) {
        // Firing without `isOnline` verification could result in one-off network issues causing a full MCP reload.
        // To prevent this, we verify the connection is down before announcing it.
        connectionListener?.announceConnectionLost();
      }

      throw new Error(`Network error with status: ${response.status}`);
    }

    const results: ToolResult = await response.json();

    if (results.tool_results.length === 0) {
      const msg = "Tool response empty.";
      getTelemetryReporter().sendTelemetryEvent("radon-ai:tool-calling-error", { error: msg });
      return textToToolResponse(msg);
    }

    const msg = results.tool_results[0].content;
    return textToToolResponse(msg);
  } catch (error) {
    let msg = `Failed tool call with error: ${error instanceof Error ? error.message : String(error)}`;
    Logger.error(MCP_LOG, msg);
    getTelemetryReporter().sendTelemetryEvent("radon-ai:tool-calling-error", { error: msg });
    return textToToolResponse(msg);
  }
}

export async function getToolSchema(connectionListener: ConnectionListener): Promise<ToolsInfo> {
  try {
    const url = new URL("/api/get_tool_schema/", BACKEND_URL);
    const token = await getLicenseToken();
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
    });

    if (response.status === 401) {
      throw Error(`Authorization failed when connecting to the backend.`);
    }

    if (response.status !== 200) {
      connectionListener?.announceConnectionLost();
      throw new Error(`Network error with status: ${response.status}`);
    }

    return response.json();
  } catch (error) {
    let msg = `Failed fetching tool schema with error: ${error instanceof Error ? error.message : String(error)}`;
    Logger.error(MCP_LOG, msg);
    getTelemetryReporter().sendTelemetryEvent("radon-ai:tool-retrieval-error", { error: msg });
    return {
      tools: [],
    };
  }
}

interface SystemResponse {
  context: string;
  system: string;
  tools: vscode.LanguageModelChatTool[];
}

export async function getSystemPrompt(userPrompt: string): Promise<SystemResponse> {
  const url = new URL("/api/system_prompt/", BACKEND_URL);
  const token = await getLicenseToken();
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({ prompt: userPrompt }),
  });

  if (response.status === 401) {
    let msg = `Authorization failed when connecting to servers.`;
    Logger.error(CHAT_LOG, msg);
    getTelemetryReporter().sendTelemetryEvent("radon-chat:auth-error", { error: msg });
    throw Error(msg);
  }

  if (response.status !== 200) {
    let msg = `Failed to fetch with status: ${response.status}`;
    Logger.error(CHAT_LOG, msg);
    getTelemetryReporter().sendTelemetryEvent("radon-chat:server-status-error", { error: msg });
    throw Error(msg);
  }

  return await response.json();
}

export async function isServerOnline(): Promise<boolean> {
  try {
    const url = new URL("/api/ping/", BACKEND_URL);
    const response = await fetch(url);
    return response.status === 200;
  } catch (error) {
    let msg = `Failed pinging Radon AI backend: ${error instanceof Error ? error.message : String(error)}`;
    Logger.error(MCP_LOG, msg);
    getTelemetryReporter().sendTelemetryEvent("radon-ai:ping-error", { error: msg });
    return false;
  }
}
