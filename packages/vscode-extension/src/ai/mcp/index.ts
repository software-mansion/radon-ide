import { lm, McpHttpServerDefinition, Uri, EventEmitter, version, Disposable } from "vscode";
import { Logger } from "../../Logger";
import { watchLicenseTokenChange } from "../../utilities/license";
import { getTelemetryReporter } from "../../utilities/telemetry";
import { insertRadonEntry, newMcpConfig } from "./configCreator";
import { readMcpConfig, writeMcpConfig } from "./fsReadWrite";
import { startLocalMcpServer } from "./server";
import { MCP_LOG } from "./utils";
import "../../../vscode.mcpConfigurationProvider.d.ts";
import { extensionContext } from "../../utilities/extensionContext";
import { ConnectionListener } from "../shared/ConnectionListener";

async function updateMcpConfig(port: number) {
  const mcpConfig = (await readMcpConfig()) || newMcpConfig();
  const updatedConfig = insertRadonEntry(mcpConfig, port);
  await writeMcpConfig(updatedConfig);
}

function directLoadRadonAI(connectionListener: ConnectionListener): Disposable[] {
  // Version suffix has to be incremented on every MCP server reload.
  let versionSuffix = 0;

  const didChangeEmitter = new EventEmitter<void>();

  connectionListener.onConnectionRestored(() => {
    didChangeEmitter.fire();
  });

  return [
    watchLicenseTokenChange(() => {
      didChangeEmitter.fire();
    }),
    lm.registerMcpServerDefinitionProvider("RadonAIMCPProvider", {
      onDidChangeServerDefinitions: didChangeEmitter.event,
      provideMcpServerDefinitions: async () => {
        const port = await startLocalMcpServer(connectionListener);
        return [
          new McpHttpServerDefinition(
            "RadonAI",
            Uri.parse(`http://127.0.0.1:${port}/mcp`),
            {},
            extensionContext.extension.packageJSON.version + `.${versionSuffix++}`
          ),
        ];
      },
    }),
  ];
}

async function fsLoadRadonAI(connectionListener: ConnectionListener) {
  try {
    // The local server has to be online before the config is written
    const mcpPort = await startLocalMcpServer(connectionListener);

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

export default function registerRadonAi(): Disposable[] {
  const connectionListener = new ConnectionListener();

  if (isDirectLoadingAvailable()) {
    const disposables = directLoadRadonAI(connectionListener);

    return [...disposables, connectionListener];
  } else {
    connectionListener.onConnectionRestored(() => {
      fsLoadRadonAI(connectionListener);
    });

    const licenseObserver = watchLicenseTokenChange(() => {
      fsLoadRadonAI(connectionListener);
    });

    return [connectionListener, licenseObserver];
  }
}
