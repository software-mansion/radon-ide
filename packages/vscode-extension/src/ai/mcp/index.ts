import { lm, McpHttpServerDefinition, Uri, EventEmitter, version } from "vscode";
import { Logger } from "../../Logger";
import { watchLicenseTokenChange } from "../../utilities/license";
import { getTelemetryReporter } from "../../utilities/telemetry";
import { insertRadonEntry, newMcpConfig } from "./configCreator";
import { readMcpConfig, writeMcpConfig } from "./fsReadWrite";
import { MCP_LOG } from "./utils";
import "../../../vscode.mcpConfigurationProvider.d.ts";
import { extensionContext } from "../../utilities/extensionContext";
import { LocalMcpServer } from "./LocalMcpServer";

async function updateMcpConfig(port: number, mcpVersion: string) {
  const mcpConfig = (await readMcpConfig()) || newMcpConfig();
  const updatedConfig = insertRadonEntry(mcpConfig, port, mcpVersion);
  await writeMcpConfig(updatedConfig);
}

function directLoadRadonAI(server: LocalMcpServer) {
  const didChangeEmitter = new EventEmitter<void>();

  let versionSuffix = 0;

  extensionContext.subscriptions.push(
    watchLicenseTokenChange(() => {
      versionSuffix += 1;
      server.setVersionSuffix(versionSuffix);
      didChangeEmitter.fire();
    })
  );

  extensionContext.subscriptions.push(
    lm.registerMcpServerDefinitionProvider("RadonAIMCPProvider", {
      onDidChangeServerDefinitions: didChangeEmitter.event,
      provideMcpServerDefinitions: async () => {
        const port = await server.getPort();
        return [
          new McpHttpServerDefinition(
            "RadonAI",
            Uri.parse(`http://127.0.0.1:${port}/mcp`),
            {},
            server.getVersion()
          ),
        ];
      },
    })
  );
}

async function fsLoadRadonAI(server: LocalMcpServer, mcpVersion: string) {
  try {
    // Server has to be online before the config is written
    const port = await server.getPort();

    // Enables Radon AI tooling on editors utilizing mcp.json configs.
    await updateMcpConfig(port, mcpVersion);

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

export default function registerRadonAi() {
  const server = new LocalMcpServer();

  if (isDirectLoadingAvailable()) {
    directLoadRadonAI(server);
  } else {
    let versionSuffix = 0;

    extensionContext.subscriptions.push(
      watchLicenseTokenChange(() => {
        server.setVersionSuffix(versionSuffix++);
        fsLoadRadonAI(server, server.getVersion());
      })
    );
  }
}
