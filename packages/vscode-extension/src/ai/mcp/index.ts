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
import { isServerOnline } from "../shared/api";

const listenForServerConnection = (fireOnConnection: EventEmitter<boolean>): Disposable => {
  const interval = setInterval(async () => {
    const isOnline = await isServerOnline();

    if (isOnline && interval) {
      fireOnConnection.fire(isOnline);
      clearInterval(interval);
    }
  });

  return new Disposable(() => {
    if (interval) {
      clearInterval(interval);
    }
  });
};

async function updateMcpConfig(port: number) {
  const mcpConfig = (await readMcpConfig()) || newMcpConfig();
  const updatedConfig = insertRadonEntry(mcpConfig, port);
  await writeMcpConfig(updatedConfig);
}

async function directLoadRadonAI() {
  // Version suffix has to be incremented on every MCP server reload.
  let versionSuffix = 0;

  let isOnline = await isServerOnline();

  const isServerOnlineEmitter = new EventEmitter<boolean>();
  const didChangeEmitter = new EventEmitter<void>();

  isServerOnlineEmitter.event((isOnlineUpdate) => {
    if (isOnline === isOnlineUpdate) {
      return; // Status hasn't changed - no-op
    }

    isOnline = isOnlineUpdate;

    if (isOnline) {
      // Connection restored - restart local MCP server
      didChangeEmitter.fire();
    } else {
      // Connection lost - ping MCP until first response
      listenForServerConnection(isServerOnlineEmitter);
    }
  });

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

export default function registerRadonAi() {
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
