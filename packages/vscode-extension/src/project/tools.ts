import { Devtools } from "./devtools";
import { extensionContext } from "../utilities/extensionContext";
import { ToolsState } from "../common/Project";
import { EventEmitter } from "stream";
import { ExpoDevPluginWebviewProvider } from "../tools/ExpoDevPluginWebviewProvider";
import { commands, Disposable, window } from "vscode";
import { Metro } from "./metro";

const TOOLS_SETTINGS_KEY = "tools_settings";

type ToolsSettings = {
  "@dev-plugins/react-query": boolean;
};

export class ToolsManager implements Disposable {
  private toolsSettings: ToolsSettings;
  private availableExpoDevPlugins: Set<string> = new Set();
  private subscriptions: Disposable[] = [];

  public constructor(
    devtools: Devtools,
    private metro: Metro,
    private readonly eventEmitter: EventEmitter
  ) {
    this.toolsSettings = Object.assign(
      {
        "@dev-plugins/react-query": false,
      },
      extensionContext.workspaceState.get(TOOLS_SETTINGS_KEY)
    );
    devtools.addListener((event, payload) => {
      if (event === "RNIDE_expoDevPluginsChanged") {
        // payload.plugins is a list of expo dev plugin names
        this.availableExpoDevPlugins = new Set(payload.plugins);
        this.handleStateChange();
      }
    });
    this.handleStateChange();
  }

  dispose() {
    this.subscriptions.forEach((s) => s.dispose());
  }

  private handleStateChange() {
    this.eventEmitter.emit("toolsStateChanged", this.getToolsState());

    if (
      this.toolsSettings["@dev-plugins/react-query"] &&
      this.availableExpoDevPlugins.has("@dev-plugins/react-query")
    ) {
      commands.executeCommand("setContext", "RNIDE.ExpoDevToolsReactQuery.available", true);
      this.subscriptions.push(
        window.registerWebviewViewProvider(
          "RadonIDE.ExpoDevToolsReactQuery.view",
          new ExpoDevPluginWebviewProvider("@dev-plugins/react-query", this.metro),
          { webviewOptions: { retainContextWhenHidden: true } }
        )
      );
      commands.executeCommand("RadonIDE.ExpoDevToolsReactQuery.view.focus");
    }
  }

  public getToolsState(): ToolsState {
    return {
      "@dev-plugins/react-query": {
        enabled: this.toolsSettings["@dev-plugins/react-query"],
        available: this.availableExpoDevPlugins.has("@dev-plugins/react-query"),
      },
    };
  }

  public async updateToolEnabledState(toolName: keyof ToolsState, enabled: boolean) {
    this.toolsSettings[toolName] = enabled;
    extensionContext.workspaceState.update(TOOLS_SETTINGS_KEY, this.toolsSettings);
    this.handleStateChange();
  }
}
