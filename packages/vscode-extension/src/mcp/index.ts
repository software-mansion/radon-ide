import { Logger } from "../Logger";
import { getOpenPort } from "../utilities/common";
import { getTelemetryReporter } from "../utilities/telemetry";
import { insertRadonEntry, newMcpConfig } from "./configCreator";
import { readMcpConfig, writeMcpConfig } from "./fsReadWrite";
import { startLocalMcpServer } from "./server";
import { MCP_LOG } from "./utils";

async function updateMcpConfig(port: number) {
  let mcpConfig = {};

  try {
    mcpConfig = await readMcpConfig();
  } catch (info) {
    if (info instanceof Error) {
      Logger.info(MCP_LOG, info.message);
    } else {
      Logger.info(MCP_LOG, String(info));
    }

    mcpConfig = newMcpConfig();
  }

  try {
    insertRadonEntry(mcpConfig, port);
    await writeMcpConfig(mcpConfig);
  } catch (error) {
    let msg = error instanceof Error ? error.message : String(error);
    Logger.error(MCP_LOG, msg);
    getTelemetryReporter().sendTelemetryEvent("mcp:error", { error: msg });
  }
}

let mcpPort: number | null = null;

export default async function loadRadonAi() {
  if (mcpPort !== null) {
    return mcpPort;
  }

  try {
    mcpPort = await getOpenPort();

    // Enables Radon AI tooling on editors utilizing mcp.json configs.
    await updateMcpConfig(mcpPort);

    await startLocalMcpServer(mcpPort);

    getTelemetryReporter().sendTelemetryEvent("mcp:started");
  } catch (error) {
    let msg = `Failed initializing MCP with error: ${error instanceof Error ? error.message : String(error)}`;
    Logger.error(MCP_LOG, msg);
    getTelemetryReporter().sendTelemetryEvent("mcp:error", { error: msg });
  }
}
