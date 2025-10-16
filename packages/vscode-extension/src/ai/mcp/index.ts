import {
  lm,
  McpHttpServerDefinition,
  Uri,
  EventEmitter,
  version,
  Disposable,
  workspace,
  ExtensionContext,
} from "vscode";
import { Logger } from "../../Logger";
import { getTelemetryReporter } from "../../utilities/telemetry";
import { insertRadonEntry, newMcpConfig, removeRadonEntry } from "./configCreator";
import { readMcpConfig, writeMcpConfig } from "./fsReadWrite";
import { ConfigLocation, getConfigLocation, MCP_LOG } from "./utils";
import "../../../vscode.mcpConfigurationProvider.d.ts";
import { LocalMcpServer } from "./LocalMcpServer";
import { disposeAll } from "../../utilities/disposables";
import { ConnectionListener } from "../shared/ConnectionListener";
import { EditorType, getEditorType } from "../../utilities/editorType";
import { RadonAIEnabledState } from "../../common/State";
import { registerRadonChat } from "../chat";

async function removeMcpConfig(location: ConfigLocation) {
  const mcpConfig = await readMcpConfig(location);
  if (!mcpConfig) {
    return;
  }
  const updatedConfig = removeRadonEntry(mcpConfig);
  await writeMcpConfig(updatedConfig, location);
}

async function updateMcpConfig(port: number) {
  const location = getConfigLocation();
  const mcpConfig = (await readMcpConfig(location)) || newMcpConfig();
  const updatedConfig = insertRadonEntry(mcpConfig, port);
  await writeMcpConfig(updatedConfig, location);

  // Remove MCP entry from the config we no longer write to.
  const unusedLocation =
    location === ConfigLocation.Global ? ConfigLocation.Project : ConfigLocation.Global;
  await removeMcpConfig(unusedLocation);
}

function directLoadRadonAI(server: LocalMcpServer, disposables: Disposable[]) {
  const didChangeEmitter = new EventEmitter<void>();

  disposables.push(
    server.onReload(() => {
      didChangeEmitter.fire();
    })
  );

  disposables.push(
    lm.registerMcpServerDefinitionProvider("RadonAIMCPProvider", {
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
    })
  );
}

async function fsUnloadRadonAi() {
  await Promise.all([
    removeMcpConfig(ConfigLocation.Global),
    removeMcpConfig(ConfigLocation.Project),
  ]).catch((e) => {
    Logger.error(
      MCP_LOG,
      `Failed removing MCP config: ${e instanceof Error ? e.message : String(e)}`
    );
  });
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

function isEnabledInSettings() {
  // Radon AI is enabled by default on VSCode only, where we can use the API to register the MCP server
  // On other editors, we need to write to mcp.json file which introduces additional friction for the user
  // and hence we want the users to explicitely enable it
  const enableRadonAiByDefault = getEditorType() === EditorType.VSCODE;

  const enabledVal = workspace
    .getConfiguration("RadonIDE")
    .get<RadonAIEnabledState>("radonAI.enabled");
  return (
    enabledVal === RadonAIEnabledState.Enabled ||
    (enabledVal === RadonAIEnabledState.Default && enableRadonAiByDefault)
  );
}

export default function registerRadonAi(context: ExtensionContext): Disposable {
  const radonAiEnabled = isEnabledInSettings();
  registerRadonChat(context, radonAiEnabled);

  const disposables: Disposable[] = [];

  function loadRadonAi() {
    const connectionListener = new ConnectionListener();
    const server = new LocalMcpServer(connectionListener);
    disposables.push(server, connectionListener);

    if (isDirectLoadingAvailable()) {
      directLoadRadonAI(server, disposables);
    } else {
      fsLoadRadonAI(server);
      disposables.push(new Disposable(() => fsUnloadRadonAi()));
    }
  }

  const configChangeDisposable = workspace.onDidChangeConfiguration((event) => {
    if (event.affectsConfiguration("RadonIDE.radonAI.enabled")) {
      disposeAll(disposables);
      if (isEnabledInSettings()) {
        loadRadonAi();
      }
    }
  });

  if (radonAiEnabled) {
    loadRadonAi();
  } else {
    // we call `fsUnload` here because we want to clear some possible leftovers
    // from the MCP configuration from earlier versions.
    fsUnloadRadonAi();
  }

  return new Disposable(() => {
    disposeAll(disposables);
    // configChangeDisposable cannot be added to the disposables array because
    // the array is only used for disposables associated with enabling the MCP server.
    // if we added it there, it'd be called on config change and we'd stop receiving config updates.
    configChangeDisposable.dispose();
  });
}
