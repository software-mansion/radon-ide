import * as vscode from "vscode";
import { Logger } from "../../Logger";
import { getLicenseToken } from "../../utilities/license";
import { getTelemetryReporter } from "../../utilities/telemetry";
import { CHAT_LOG } from "../chat";
import { ToolResponse, ToolResult, ToolsInfo } from "../mcp/models";
import { textToToolResponse } from "../mcp/utils";

const BACKEND_URL = "https://radon-ai-backend.swmansion.com/";

const PLACEHOLDER_ID = "3241"; // This placeholder is needed by the API, but the value doesn't matter

export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthenticationError";
  }
}

export class ServerUnreachableError extends Error {
  constructor(message: string, cause: Error) {
    super(message, { cause });
    this.name = "NetworkError";
  }
}

export async function invokeToolCall(
  toolName: string,
  args: unknown,
  callId: string = PLACEHOLDER_ID
): Promise<ToolResponse> {
  getTelemetryReporter().sendTelemetryEvent("radon-ai:tool-called", { toolName });
  const url = new URL("/api/tool_calls/", BACKEND_URL);
  const token = await getLicenseToken();
  let response: Response | null = null;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({
        tool_calls: [
          {
            name: toolName,
            id: callId,
            args,
          },
        ],
      }),
    });
  } catch (error) {
    // we don't want to send network failure events to telemetry as they would happen while user is likely offline
    // anyway and they are not indicative of a problem with the API.
    throw new ServerUnreachableError("Network failure", error as Error);
  }

  if (response.status === 401) {
    getTelemetryReporter().sendTelemetryEvent("radon-ai:tool-calling-error", {
      toolName,
      error: `Authorization failed`,
    });
    throw new AuthenticationError(`Authorization failed when connecting to the backend.`);
  }

  if (!response.ok) {
    getTelemetryReporter().sendTelemetryEvent("radon-ai:tool-calling-error", {
      toolName,
      error: `Invalid status code: ${response.status}`,
    });
    throw new Error(`Server responded with status code: ${response.status}`);
  }

  const results: ToolResult = await response.json();

  if (results.tool_results.length === 0) {
    getTelemetryReporter().sendTelemetryEvent("radon-ai:tool-calling-error", {
      toolName,
      error: "Tool response empty",
    });
    return textToToolResponse("Tool response empty.");
  }

  const msg = results.tool_results[0].content;
  return textToToolResponse(msg);
}

export async function fetchRemoteToolSchema(): Promise<ToolsInfo> {
  const url = new URL("/api/get_tool_schema/", BACKEND_URL);
  const token = await getLicenseToken();
  let response: Response | null = null;
  try {
    response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
    });
  } catch (error) {
    // we don't want to send network failure events to telemetry as they would happen while user is likely offline
    // anyway and they are not indicative of a problem with the API.
    throw new ServerUnreachableError("Network failure", error as Error);
  }

  if (response.status === 401) {
    getTelemetryReporter().sendTelemetryEvent("radon-ai:get-tool-schema", {
      error: `Authorization failed`,
    });
    throw new AuthenticationError(`Authorization failed when connecting to the backend.`);
  }

  if (!response.ok) {
    getTelemetryReporter().sendTelemetryEvent("radon-ai:get-tool-schema", {
      error: `Invalid status code: ${response.status}`,
    });
    throw new Error(`Server responded with status code: ${response.status}`);
  }

  return response.json();
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
