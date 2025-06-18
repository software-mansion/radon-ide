import { Logger } from "../../Logger";
import { watchLicenseTokenChange } from "../../utilities/license";
import { getTelemetryReporter } from "../../utilities/telemetry";
import { insertRadonEntry, newMcpConfig } from "./configCreator";
import { readMcpConfig, writeMcpConfig } from "./fsReadWrite";
import { startLocalMcpServer } from "./server";
import { MCP_LOG } from "./utils";
import { lm, McpHttpServerDefinition, Uri, EventEmitter } from "vscode";
import "../../../vscode.mcpConfigurationProvider.d.ts";
import { extensionContext } from "../../utilities/extensionContext";

async function updateMcpConfig(port: number) {
  const mcpConfig = (await readMcpConfig()) || newMcpConfig();
  const updatedConfig = insertRadonEntry(mcpConfig, port);
  await writeMcpConfig(updatedConfig);
}

export function loadRadonAIOnVscode1_100() {
  const serverStartPromise = startLocalMcpServer();
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
        const port = await serverStartPromise;
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
  return true;
}

async function loadRadonAI() {
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

export default function registerRadonAi() {
  // @ts-ignore lm.registerMcpServerDefinitionProvider API is only availble in VSCode 1.100+, we do runtime check here as it shouldn't be used in Cursor or Windsurf
  if (lm.registerMcpServerDefinitionProvider) {
    // We need to register MCP definition before extension's activate resolves.
    // As this is a sync call, we don't need to await for the server to actually load
    // and we can simply return here to not delay the activation flow.
    // We will need the server to start before
    return loadRadonAIOnVscode1_100();
  } else {
    watchLicenseTokenChange(() => {
      loadRadonAI();
    });
  }
}
