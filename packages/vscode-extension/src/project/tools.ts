import { Devtools } from "./devtools";
import { extensionContext } from "../utilities/extensionContext";
import { ToolsState } from "../common/Project";
import { EventEmitter } from "stream";

const TOOLS_SETTINGS_KEY = "tools_settings";

type ToolsSettings = {
  "@dev-tools/react-query": boolean;
};

export class ToolsManager {
  private toolsSettings: ToolsSettings;
  private availableExpoDevPlugins: Set<string> = new Set();

  public constructor(devtools: Devtools, private readonly eventEmitter: EventEmitter) {
    this.toolsSettings = Object.assign(
      {
        "@dev-tools/react-query": false,
      },
      extensionContext.workspaceState.get(TOOLS_SETTINGS_KEY)
    );
    devtools.addListener((event, payload) => {
      if (event === "RNIDE_expoDevPluginsChanged") {
        // payload is a list of expo dev plugin names
        this.availableExpoDevPlugins = new Set(payload);
        this.emitChangeEvent();
      }
    });
    this.emitChangeEvent();
  }

  private emitChangeEvent() {
    this.eventEmitter.emit("toolsStateChanged", this.getToolsState());
  }

  public getToolsState(): ToolsState {
    return {
      "@dev-tools/react-query": {
        enabled: this.toolsSettings["@dev-tools/react-query"],
        available: this.availableExpoDevPlugins.has("@dev-tools/react-query"),
      },
    };
  }

  public async updateToolEnabledState(toolName: keyof ToolsState, enabled: boolean) {
    this.toolsSettings[toolName] = enabled;
    extensionContext.workspaceState.update(TOOLS_SETTINGS_KEY, this.toolsSettings);
    this.emitChangeEvent();
  }
}
