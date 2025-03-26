import * as vscode from "vscode";

import { Logger } from "../Logger";
import { getTelemetryReporter } from "../utilities/telemetry";
import { CHAT_LOG } from ".";

const BASE_RADON_AI_URL = "https://radon-ai-backend.swmansion.com";

export async function getSystemPrompt(userPrompt: string, jwt: string): Promise<any> {
  try {
    const url = new URL("/api/system_prompt/", BASE_RADON_AI_URL);
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${jwt}`,
      },
      body: JSON.stringify({ prompt: userPrompt }),
    });

    if (response.status !== 200) {
      Logger.error(
        CHAT_LOG,
        `Failed to fetch response from Radon AI with status: ${response.status}`
      );
      getTelemetryReporter().sendTelemetryEvent("chat:error", {
        error: `Failed to fetch with status: ${response.status}`,
      });
      return;
    }
    return await response.json();
  } catch (error) {
    if (error instanceof Error) {
      Logger.error(
        CHAT_LOG,
        `Failed to fetch response from Radon AI with message: ${error.message}`
      );
      getTelemetryReporter().sendTelemetryEvent("chat:error", { error: error.message });
    } else {
      Logger.error(CHAT_LOG, `Failed to fetch response from Radon AI: ${String(error)}`);
    }
  }
  return;
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
): Promise<vscode.LanguageModelToolResultPart[] | undefined> {
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

    if (response.status !== 200) {
      Logger.error(
        CHAT_LOG,
        `Failed to fetch response from Radon AI with status: ${response.status}`
      );
      getTelemetryReporter().sendTelemetryEvent("chat:error", {
        error: `Failed to fetch with status: ${response.status}`,
      });
      return;
    }

    const results: ToolResult = await response.json();
    const toolResults = results.tool_results.map((result) => ({
      callId: result.tool_call_id,
      content: [result.content],
    }));
    return toolResults;
  } catch (error) {
    if (error instanceof Error) {
      Logger.error(CHAT_LOG, `Tool call failed with message: ${error.message}`);
      getTelemetryReporter().sendTelemetryEvent("chat:error", { error: error.message });
    } else {
      Logger.error(CHAT_LOG, `Tool call failed: ${String(error)}`);
    }
  }
  return;
}
