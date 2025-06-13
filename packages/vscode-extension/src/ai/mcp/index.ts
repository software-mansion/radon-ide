import { kill } from "process";
import { Logger } from "../../Logger";
import { getOpenPort } from "../../utilities/common";
import { watchLicenseTokenChange } from "../../utilities/license";
import { getTelemetryReporter } from "../../utilities/telemetry";
import { insertRadonEntry, newMcpConfig } from "./configCreator";
import { readMcpConfig, writeMcpConfig } from "./fsReadWrite";
import { startLocalMcpServer } from "./server";
import { MCP_LOG } from "./utils";

async function updateMcpConfig(port: number) {
  const mcpConfig = (await readMcpConfig()) || newMcpConfig();
  const updatedConfig = insertRadonEntry(mcpConfig, port);
  await writeMcpConfig(updatedConfig);
}

let mcpPort: number | null = null;

async function loadRadonAi() {
  if (mcpPort !== null) {
    return mcpPort;
  }

  try {
    mcpPort = await getOpenPort();

    // Enables Radon AI tooling on editors utilizing mcp.json configs.
    await updateMcpConfig(mcpPort);

    await startLocalMcpServer(mcpPort);

    getTelemetryReporter().sendTelemetryEvent("radon-ai:mcp-started");
  } catch (error) {
    let msg = `Failed initializing MCP with error: ${error instanceof Error ? error.message : String(error)}`;
    Logger.error(MCP_LOG, msg);
    getTelemetryReporter().sendTelemetryEvent("radon-ai:mcp-initialization-error", { error: msg });
  }
}

export default function registerRadonAi() {
  watchLicenseTokenChange(() => {
    // starts regardless of token validity - offline tools don't require a valid token
    if (mcpPort !== null) {
      // kill previous instance
      kill(mcpPort);
    }
    loadRadonAi();
  });
}
