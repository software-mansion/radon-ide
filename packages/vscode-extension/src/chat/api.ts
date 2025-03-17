import { Logger } from "../Logger";
import { getTelemetryReporter } from "../utilities/telemetry";

const BASE_RADON_AI_URL = "http://127.0.0.1:8000";

export async function getSystemPrompt(userPrompt: string, jwt: string): Promise<any> {
  try {
    const url = new URL("/api/system_prompt", BASE_RADON_AI_URL);
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${jwt}`,
      },
      body: JSON.stringify({ prompt: userPrompt }),
    });

    if (response.status !== 200) {
      Logger.error(`Failed to fetch response from Radon AI with status: ${response.status}`);
      getTelemetryReporter().sendTelemetryEvent("chat:error", {
        error: `Failed to fetch with status: ${response.status}`,
      });
      return;
    }
    return await response.json();
  } catch (error) {
    if (error instanceof Error) {
      Logger.error(error.message);
      getTelemetryReporter().sendTelemetryEvent("chat:error", { error: error.message });
    } else {
      Logger.error(String(error));
    }
  }
  return;
}
