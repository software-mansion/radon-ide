import { commands, Disposable } from "vscode";
import { ArchitectureStrategy, NetworkPlugin } from "./network-plugin";
import { disposeAll } from "../../utilities/disposables";

export default class NewArchitecture implements ArchitectureStrategy {
  private networkListeners: Disposable[] = [];

  public get pluginAvailable() {
    return this.plugin.networkBridge.bridgeAvailable;
  }

  constructor(private plugin: NetworkPlugin) {}

  public activate(): void {
    if (!this.pluginAvailable) {
      return;
    }
    // placeholders below
    this.plugin.websocketBackend.start().then(() => {
      commands.executeCommand("setContext", `RNIDE.Tool.Network.available`, true);
      this.networkListeners.push(
        this.plugin.networkBridge.onEvent("requestWillBeSent", (payload) => {
          console.log("mleko", payload);
        })
      );
      this.networkListeners.push(
        this.plugin.networkBridge.onEvent("requestWillBeSentExtraInfo", (payload) => {
          console.log("mleko", payload);
        })
      );
      this.networkListeners.push(
        this.plugin.networkBridge.onEvent("responseReceived", (payload) => {
          console.log("mleko", payload);
        })
      );
      this.networkListeners.push(
        this.plugin.networkBridge.onEvent("loadingFinished", (payload) => {
          console.log("mleko", payload);
        })
      );
      this.networkListeners.push(
        this.plugin.networkBridge.onEvent("enable", () => {
          console.log("mleko", "Network Inspector enabled");
        })
      );
      this.networkListeners.push(
        this.plugin.networkBridge.onEvent("disable", () => {
          console.log("mleko", "Network Inspector disabled");
        })
      );
      this.plugin.networkBridge.onEvent("runtimeEnable", () => {
        this.plugin.networkBridge.enableNetworkInspector();
      });
      this.plugin.networkBridge.enableNetworkInspector();
    });
  }

  public deactivate(): void {
    disposeAll(this.networkListeners);
    if (!this.pluginAvailable) {
      return;
    }
    this.plugin.networkBridge.disableNetworkInspector();
    commands.executeCommand("setContext", `RNIDE.Tool.Network.available`, false);
  }

  public openTool(): void {
    // same UX: focus the network view
    commands.executeCommand(`RNIDE.Tool.Network.view.focus`);
  }

  public dispose(): void {
    disposeAll(this.networkListeners);
  }

  public websocketMessageHandler(message: any): void {
    // placeholder
    console.log("MLEKO", message);
  }
}
