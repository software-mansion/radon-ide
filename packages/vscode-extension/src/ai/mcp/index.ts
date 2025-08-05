import { lm, McpHttpServerDefinition, Uri, EventEmitter, version, Disposable } from "vscode";
import { Logger } from "../../Logger";
import { getTelemetryReporter } from "../../utilities/telemetry";
import { insertRadonEntry, newMcpConfig } from "./configCreator";
import { readMcpConfig, writeMcpConfig } from "./fsReadWrite";
import { MCP_LOG } from "./utils";
import "../../../vscode.mcpConfigurationProvider.d.ts";
import { LocalMcpServer } from "./LocalMcpServer";
import { disposeAll } from "../../utilities/disposables";
import { ConnectionListener } from "../shared/ConnectionListener";

async function updateMcpConfig(port: number) {
  const mcpConfig = (await readMcpConfig()) || newMcpConfig();
  const updatedConfig = insertRadonEntry(mcpConfig, port);
  await writeMcpConfig(updatedConfig);
}

function directLoadRadonAI(server: LocalMcpServer): Disposable {
  const didChangeEmitter = new EventEmitter<void>();

  const onReloadDisposable = server.onReload(() => {
    didChangeEmitter.fire();
  });

  const mcpServerEntry = lm.registerMcpServerDefinitionProvider("RadonAIMCPProvider", {
    onDidChangeMcpServerDefinitions: didChangeEmitter.event,
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
  });

  return new Disposable(() => disposeAll([onReloadDisposable, mcpServerEntry]));
}

async function fsLoadRadonAI(server: LocalMcpServer) {
  try {
    // The local server has to be online before the config is written
    const port = await server.getPort();

    // Enables Radon AI tooling on editors utilizing mcp.json configs.
    await updateMcpConfig(port);

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

export default function registerRadonAi(
  location: ConfigLocation = ConfigLocation.Project
): Disposable {
  const connectionListener = new ConnectionListener();
  const server = new LocalMcpServer(connectionListener);

  if (isDirectLoadingAvailable()) {
    const disposables = directLoadRadonAI(server);

    return new Disposable(() => disposeAll([disposables, server, connectionListener]));
  } else {
    const onReloadDisposable = server.onReload(() => {
      fsLoadRadonAI(server);
    });

    return new Disposable(() => disposeAll([onReloadDisposable, server, connectionListener]));
  }
}
