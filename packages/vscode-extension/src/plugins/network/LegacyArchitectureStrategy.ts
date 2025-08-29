import { commands, Disposable } from "vscode";
import { ArchitectureStrategy, NetworkPlugin } from "./network-plugin";
import { RadonInspectorBridge } from "../../project/bridge";
import { disposeAll } from "../../utilities/disposables";

export default class LegacyArchitecture implements ArchitectureStrategy {
  private devtoolsListeners: Disposable[] = [];
  private readonly inspectorBridge: RadonInspectorBridge;

  constructor(private plugin: NetworkPlugin) {
    this.inspectorBridge = this.plugin.inspectorBridge;
  }

  public get pluginAvailable() {
    return true;
  }

  private sendCDPMessage = (messageData: unknown) => {
    this.inspectorBridge.sendPluginMessage("network", "cdp-message", messageData);
  };

  public activate(): void {
    this.plugin.websocketBackend.start().then(() => {
      commands.executeCommand("setContext", `RNIDE.Tool.Network.available`, true);
      this.devtoolsListeners.push(
        this.plugin.inspectorBridge.onEvent("pluginMessage", (payload) => {
          if (payload.pluginId === "network") {
            this.plugin.websocketBackend.broadcast(payload.data);
          }
        })
      );
      this.devtoolsListeners.push(
        this.plugin.inspectorBridge.onEvent("appReady", () => {
          this.sendCDPMessage({ method: "Network.enable", params: {} });
        })
      );
      this.sendCDPMessage({ method: "Network.enable", params: {} });
    });
  }

  public deactivate(): void {
    disposeAll(this.devtoolsListeners);
    this.sendCDPMessage({ method: "Network.disable", params: {} });
    commands.executeCommand("setContext", `RNIDE.Tool.Network.available`, false);
  }

  public openTool(): void {
    commands.executeCommand(`RNIDE.Tool.Network.view.focus`);
  }

  public dispose() {
    disposeAll(this.devtoolsListeners);
  }

  public websocketMessageHandler(message: unknown): void {
    this.sendCDPMessage(message);
  }
}
