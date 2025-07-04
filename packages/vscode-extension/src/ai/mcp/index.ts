import { lm, McpHttpServerDefinition, Uri, EventEmitter, version } from "vscode";
import { Logger } from "../../Logger";
import { watchLicenseTokenChange } from "../../utilities/license";
import { getTelemetryReporter } from "../../utilities/telemetry";
import { insertRadonEntry, newMcpConfig } from "./configCreator";
import { readMcpConfig, writeMcpConfig } from "./fsReadWrite";
import { startLocalMcpServer } from "./server";
import { MCP_LOG } from "./utils";
import "../../../vscode.mcpConfigurationProvider.d.ts";
import { extensionContext } from "../../utilities/extensionContext";

async function updateMcpConfig(port: number) {
  const mcpConfig = (await readMcpConfig()) || newMcpConfig();
  const updatedConfig = insertRadonEntry(mcpConfig, port);
  await writeMcpConfig(updatedConfig);
}

function directLoadRadonAI() {
  const didChangeEmitter = new EventEmitter<void>();

  // version suffix is incremented whenever we get auth token update notification
  // this way we request vscode to reload the tool on regular basis but also immediately
  // after the user inputs the license token
  let versionSuffix = 0;
  extensionContext.subscriptions.push(
    watchLicenseTokenChange(() => {
      versionSuffix += 1;
      didChangeEmitter.fire();
    })
  );

  extensionContext.subscriptions.push(
    lm.registerMcpServerDefinitionProvider("RadonAIMCPProvider", {
      onDidChangeServerDefinitions: didChangeEmitter.event,
      provideMcpServerDefinitions: async () => {
        const port = await startLocalMcpServer();
        return [
          new McpHttpServerDefinition(
            "RadonAI",
            Uri.parse(`http://127.0.0.1:${port}/mcp`),
            {},
            extensionContext.extension.packageJSON.version + `.${versionSuffix}`
          ),
        ];
      },
    })
  );
}

async function fsLoadRadonAI() {
  try {
    // Server has to be online before the config is written
    const mcpPort = await startLocalMcpServer();

    // Enables Radon AI tooling on editors utilizing mcp.json configs.
    await updateMcpConfig(mcpPort);

    getTelemetryReporter().sendTelemetryEvent("radon-ai:mcp-started");
  } catch (error) {
    let msg = `Failed initializing MCP with error: ${error instanceof Error ? error.message : String(error)}`;
    Logger.error(MCP_LOG, msg);
    getTelemetryReporter().sendTelemetryEvent("radon-ai:mcp-initialization-error", { error: msg });
  }
}

function isDirectLoadingAvailable() {
  return (
    // @ts-ignore lm.registerMcpServerDefinitionProvider API is only available in VSCode 1.101+. Cursor and Windsurf both use <1.101 VSCode versions
    lm.registerMcpServerDefinitionProvider &&
    version.localeCompare("1.101.0", undefined, { numeric: true }) >= 0
  );
}

export default async function registerRadonAi() {
  // The `registerRadonAi` is async, but never awaited, to prevent slowing down Radon IDE startup.
  if (isDirectLoadingAvailable()) {
    directLoadRadonAI();
  } else {
    extensionContext.subscriptions.push(
      watchLicenseTokenChange(() => {
        fsLoadRadonAI();
      })
    );
  }
}
