import { getLicenseToken } from "../../utilities/license";
import { getTelemetryReporter } from "../../utilities/telemetry";
import { ToolResponse, ToolResult } from "../mcp/models";
import { textToToolResponse } from "../mcp/utils";
import { AuthorizationError } from "../../common/Errors";

const BACKEND_URL = "https://radon-ai-backend.swmansion.com/";

export const AI_API_PLACEHOLDER_ID = "3241"; // This placeholder is needed by the API, but the value doesn't matter

export const AI_LOG = "[AI]";

export class ServerUnreachableError extends Error {
  constructor(message: string, cause: Error) {
    super(message, { cause });
    this.name = "NetworkError";
  }
}

export async function invokeToolCall(
  toolName: string,
  args: unknown,
  callId: string = AI_API_PLACEHOLDER_ID
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
    throw new AuthorizationError(`Authorization failed when connecting to the backend.`);
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
