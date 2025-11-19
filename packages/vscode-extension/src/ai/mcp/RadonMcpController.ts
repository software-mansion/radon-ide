import {
  lm,
  McpHttpServerDefinition,
  Uri,
  version,
  Disposable,
  workspace,
  ExtensionContext,
  commands,
  cursor,
  EventEmitter,
} from "vscode";
import { Logger } from "../../Logger";
import { LocalMcpServer } from "./LocalMcpServer";
import { disposeAll } from "../../utilities/disposables";
import { registerRadonChat } from "../chat";
import { extensionContext } from "../../utilities/extensionContext";
import { cleanupOldMcpConfigEntries } from "./configFileHelper";

const RADON_AI_MCP_ENTRY_NAME = "RadonAI";
const RADON_AI_MCP_PROVIDER_ID = "RadonAIMCPProvider";

function canUseMcpDefinitionProviderAPI() {
  return (
    // @ts-ignore lm.registerMcpServerDefinitionProvider API is only available in VSCode 1.101+.
    lm.registerMcpServerDefinitionProvider &&
    version.localeCompare("1.101.0", undefined, { numeric: true }) >= 0
  );
}

function canUseMcpRegistrationAPIInCursor() {
  return cursor && cursor.mcp.registerServer;
}

async function startRadonAIInCursor(server: LocalMcpServer) {
  try {
    const port = await server.getPort();
    // Just to be extra careful, we unregister the server first as the Cursor docs doesn't
    // mention what happens if we register server under the same name twice.
    cursor.mcp.unregisterServer(RADON_AI_MCP_ENTRY_NAME);
    cursor.mcp.registerServer({
      name: RADON_AI_MCP_ENTRY_NAME,
      server: {
        url: `http://127.0.0.1:${port}/mcp`,
        headers: {},
      },
    });
    server.onToolListChanged(() => {
      // Cursor has a bug where it doesn't respond to the tool list changed notification
      // This bug is reported meny times including here: https://forum.cursor.com/t/mcp-client-update-tools/77294
      // To workaround it, we use a hidden command that Cursor exposes: `mcp.toolListChanged`
      // Despite this method updating the tool list properly, it also throws an error and so we ignore it here
      commands.executeCommand("mcp.toolListChanged").then(
        () => {},
        (_error) => {
          // ignore the error
        }
      );
    });
    server.onDispose(() => {
      cursor.mcp.unregisterServer(RADON_AI_MCP_ENTRY_NAME);
    });
  } catch (error) {
    Logger.error(
      `Failed registering Radon AI in Cursor: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

function isEnabledInSettings() {
  return workspace.getConfiguration("RadonIDE").get<boolean>("radonAI.enabledBoolean") ?? true;
}

class RadonMcpController implements Disposable {
  private server: LocalMcpServer | undefined = undefined;
  private serverChangedEmitter = new EventEmitter<void>();
  private disposables: Disposable[] = [];

  constructor(context: ExtensionContext) {
    const radonAiEnabled = isEnabledInSettings();
    registerRadonChat(context, radonAiEnabled);
    this.registerRadonMcpServerProviderInVSCode();
    cleanupOldMcpConfigEntries();

    this.disposables.push(
      workspace.onDidChangeConfiguration((event) => {
        if (event.affectsConfiguration("RadonIDE.radonAI.enabledBoolean")) {
          if (isEnabledInSettings()) {
            this.enableServer();
          } else {
            this.disableServer();
          }
        }
      })
    );

    if (isEnabledInSettings()) {
      this.enableServer();
    }
  }

  private enableServer() {
    this.server = new LocalMcpServer();
    if (canUseMcpRegistrationAPIInCursor()) {
      startRadonAIInCursor(this.server);
    }
    this.serverChangedEmitter.fire();
  }

  private disableServer() {
    this.server?.dispose();
    this.server = undefined;
    this.serverChangedEmitter.fire();
  }

  /**
   * VSCode APIs requires that the MCP server provider is registered immediately along the
   * extension activation process. It is needed because the extension package.json already
   * declares the MCP server provider and the lack of an implementation for it would result
   * in extension activation error.
   */
  private registerRadonMcpServerProviderInVSCode() {
    if (!canUseMcpDefinitionProviderAPI()) {
      return;
    }
    this.disposables.push(
      lm.registerMcpServerDefinitionProvider(RADON_AI_MCP_PROVIDER_ID, {
        onDidChangeMcpServerDefinitions: this.serverChangedEmitter.event,
        provideMcpServerDefinitions: async () => {
          const server = this.server;
          if (server) {
            const port = await server.getPort();
            return [
              new McpHttpServerDefinition(
                RADON_AI_MCP_ENTRY_NAME,
                Uri.parse(`http://127.0.0.1:${port}/mcp`),
                {},
                extensionContext.extension.packageJSON.version
              ),
            ];
          } else {
            return [];
          }
        },
      })
    );
  }

  dispose() {
    this.server?.dispose();
    this.serverChangedEmitter.dispose();
    disposeAll(this.disposables);
  }
}

export function registerRadonAI(context: ExtensionContext) {
  return new RadonMcpController(context);
}
