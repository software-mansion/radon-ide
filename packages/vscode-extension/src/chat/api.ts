import * as vscode from "vscode";

import { Logger } from "../Logger";
import { getTelemetryReporter } from "../utilities/telemetry";
import { CHAT_LOG } from ".";

const BASE_RADON_AI_URL = "https://radon-ai-backend.swmansion.com";

interface SystemResponse {
  context: string;
  system: string;
  tools: vscode.LanguageModelChatTool[];
}

export async function getSystemPrompt(userPrompt: string, jwt: string): Promise<SystemResponse> {
  const url = new URL("/api/system_prompt/", BASE_RADON_AI_URL);
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${jwt}`,
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

interface ToolResult {
  tool_results: {
    content: string;
    tool_call_id: string;
  }[];
}

export async function invokeToolCall(
  toolCall: vscode.LanguageModelToolCallPart,
  jwt: string
): Promise<vscode.LanguageModelToolResultPart[]> {
  try {
    const url = new URL("/api/tool_calls/", BASE_RADON_AI_URL);
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${jwt}`,
      },
      body: JSON.stringify({
        tool_calls: [{ name: toolCall.name, id: toolCall.callId, args: toolCall.input }],
      }),
    });

    if (response.status === 401) {
      let msg = `Authorization failed when calling tool.`;
      Logger.error(CHAT_LOG, msg);
      getTelemetryReporter().sendTelemetryEvent("radon-chat:tool-auth-error");
      return [];
    }

    if (response.status !== 200) {
      let msg = `Failed to call tool with status: ${response.status}`;
      Logger.error(CHAT_LOG, msg);
      getTelemetryReporter().sendTelemetryEvent("radon-chat:tool-call-error", { error: msg });
      return [];
    }

    const results: ToolResult = await response.json();
    const toolResults = results.tool_results.map((result) => ({
      callId: result.tool_call_id,
      content: [result.content],
    }));
    return toolResults;
  } catch (error) {
    let msg = `Tool call failed with message: ${error instanceof Error ? error.message : String(error)}`;
    Logger.error(CHAT_LOG, msg);
    getTelemetryReporter().sendTelemetryEvent("radon-chat:tool-call-error", { error: msg });
    return [];
  }
}
