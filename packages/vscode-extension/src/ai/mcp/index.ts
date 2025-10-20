import {
  lm,
  McpHttpServerDefinition,
  Uri,
  version,
  Disposable,
  workspace,
  ExtensionContext,
  commands,
} from "vscode";
import { Logger } from "../../Logger";
import { getTelemetryReporter } from "../../utilities/telemetry";
import {
  insertRadonEntry,
  newMcpConfig,
  removeOldRadonEntry,
  removeRadonEntry,
} from "./configCreator";
import { readMcpConfig, writeMcpConfig } from "./fsReadWrite";
import { ConfigLocation, getConfigLocation, MCP_LOG } from "./utils";
import "../../../vscode.mcpConfigurationProvider.d.ts";
import { LocalMcpServer } from "./LocalMcpServer";
import { disposeAll } from "../../utilities/disposables";
import { EditorType, getEditorType } from "../../utilities/editorType";
import { RadonAIEnabledState } from "../../common/State";
import { registerRadonChat } from "../chat";
import { extensionContext } from "../../utilities/extensionContext";

async function updateMcpConfig(
  location: ConfigLocation,
  updateFn: (config: string) => string | undefined
) {
  const mcpConfig = await readMcpConfig(location);
  if (!mcpConfig) {
    return;
  }
  const updatedConfig = updateFn(mcpConfig);
  if (updatedConfig) {
    await writeMcpConfig(updatedConfig, location);
  }
}

function directLoadRadonAI(server: LocalMcpServer, disposables: Disposable[]) {
  disposables.push(
    lm.registerMcpServerDefinitionProvider("RadonAIMCPProvider", {
      provideMcpServerDefinitions: async () => {
        const port = await server.getPort();
        return [
          new McpHttpServerDefinition(
            "RadonAI",
            Uri.parse(`http://127.0.0.1:${port}/mcp`),
            {},
            extensionContext.extension.packageJSON.version
          ),
        ];
      },
    })
  );
}

async function fsUnloadRadonAi() {
  await Promise.all([
    updateMcpConfig(ConfigLocation.Global, removeRadonEntry),
    updateMcpConfig(ConfigLocation.Project, removeRadonEntry),
  ]).catch((e) => {
    Logger.error(
      MCP_LOG,
      `Failed removing MCP config: ${e instanceof Error ? e.message : String(e)}`
    );
  });
}

async function fsLoadRadonAI(server: LocalMcpServer) {
  try {
    // Enables Radon AI tooling on editors utilizing mcp.json configs.
    const location = getConfigLocation();
    // remove radon from the other location (in case it is there)
    await updateMcpConfig(
      location === ConfigLocation.Global ? ConfigLocation.Project : ConfigLocation.Global,
      removeRadonEntry
    );
    // update the config with the new entry for Radon MCP server
    const mcpConfig = (await readMcpConfig(location)) || newMcpConfig();
    await updateMcpConfig(location, () => insertRadonEntry(mcpConfig));

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

export default function registerRadonAi(context: ExtensionContext) {
  const radonAiEnabled = isEnabledInSettings();
  registerRadonChat(context, radonAiEnabled);

  updateMcpConfig(ConfigLocation.Global, removeOldRadonEntry);
  updateMcpConfig(ConfigLocation.Project, removeOldRadonEntry);

  const disposables: Disposable[] = [];

  function loadRadonAi() {
    const server = new LocalMcpServer();
    disposables.push(server);

    if (isDirectLoadingAvailable()) {
      directLoadRadonAI(server, disposables);
    } else {
      fsLoadRadonAI(server);
      server.onToolListChanged(() => {
        // Cursor has a bug where it doesn't respond to the tool list changed notification
        // This bug is reported meny times including here: https://forum.cursor.com/t/mcp-client-update-tools/77294
        // To workaround it, we use a hidden command that Cursor exposes: `mcp.toolListChanged`
        commands.executeCommand("mcp.toolListChanged");
      });
    }
  }

  const configChangeDisposable = workspace.onDidChangeConfiguration((event) => {
    if (event.affectsConfiguration("RadonIDE.radonAI.enabled")) {
      disposeAll(disposables);
      if (isEnabledInSettings()) {
        loadRadonAi();
      } else {
        fsUnloadRadonAi();
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
