import { lm, McpHttpServerDefinition, Uri, EventEmitter, version, Disposable } from "vscode";
import { Logger } from "../../Logger";
import { watchLicenseTokenChange } from "../../utilities/license";
import { getTelemetryReporter } from "../../utilities/telemetry";
import { insertRadonEntry, newMcpConfig } from "./configCreator";
import { readMcpConfig, writeMcpConfig } from "./fsReadWrite";
import { MCP_LOG } from "./utils";
import "../../../vscode.mcpConfigurationProvider.d.ts";
import { LocalMcpServer } from "./LocalMcpServer";
import { disposeAll } from "../../utilities/disposables";
import { ConnectionListener } from "../shared/ConnectionListener";

async function updateMcpConfig(port: number, mcpVersion: string) {
  const mcpConfig = (await readMcpConfig()) || newMcpConfig();
  const updatedConfig = insertRadonEntry(mcpConfig, port, mcpVersion);
  await writeMcpConfig(updatedConfig);
}

function directLoadRadonAI(
  server: LocalMcpServer,
  connectionListener: ConnectionListener
): Disposable {
  // Version suffix has to be incremented on every MCP server reload.
  let versionSuffix = 0;

  const didChangeEmitter = new EventEmitter<void>();

  const connectionChangeListener = connectionListener.onConnectionRestored(() => {
    versionSuffix += 1;
    server.setVersionSuffix(versionSuffix);
    didChangeEmitter.fire();
  });

  const licenseChangeListener = watchLicenseTokenChange(() => {
    versionSuffix += 1;
    server.setVersionSuffix(versionSuffix);
    didChangeEmitter.fire();
  });

  const mcpServerEntry = lm.registerMcpServerDefinitionProvider("RadonAIMCPProvider", {
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
  });

  return new Disposable(() =>
    disposeAll([connectionChangeListener, licenseChangeListener, mcpServerEntry])
  );
}

async function fsLoadRadonAI(server: LocalMcpServer) {
  try {
    // The local server has to be online before the config is written
    const port = await server.getPort();

    // Enables Radon AI tooling on editors utilizing mcp.json configs.
    await updateMcpConfig(port, server.getVersion());

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

export default function registerRadonAi(): Disposable {
  const connectionListener = new ConnectionListener();
  const server = new LocalMcpServer(connectionListener);

  if (isDirectLoadingAvailable()) {
    const disposables = directLoadRadonAI(server, connectionListener);

    return new Disposable(() => disposeAll([disposables, server, connectionListener]));
  } else {
    let versionSuffix = 0;

    const fsReloadRadonAi = () => {
      server.setVersionSuffix(versionSuffix++);
      fsLoadRadonAI(server);
    };

    const connectionChangeListener = connectionListener.onConnectionRestored(fsReloadRadonAi);
    const licenseObserver = watchLicenseTokenChange(fsReloadRadonAi);

    return new Disposable(() =>
      disposeAll([server, connectionListener, connectionChangeListener, licenseObserver])
    );
  }
}
