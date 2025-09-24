import { commands, Disposable } from "vscode";
import { ArchitectureStrategy, BroadcastListener, NetworkPlugin } from "./network-plugin";
import { disposeAll } from "../../utilities/disposables";
import { WebviewMessage } from "../../network/types/panelMessageProtocol";

export default class NewArchitecture implements ArchitectureStrategy {
  private networkListeners: Disposable[] = [];
  private broadcastListeners: BroadcastListener[] = [];

  public get pluginAvailable() {
    return this.plugin.networkBridge.bridgeAvailable;
  }

  constructor(private plugin: NetworkPlugin) {}

  private setupListeners() {
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
  }

  public activate(): void {
    if (!this.pluginAvailable) {
      return;
    }
    // placeholders below

    commands.executeCommand("setContext", `RNIDE.Tool.Network.available`, true);
    this.setupListeners();

    this.plugin.networkBridge.onEvent("runtimeEnable", () => {
      this.plugin.networkBridge.enableNetworkInspector();
    });
    this.plugin.networkBridge.enableNetworkInspector();
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

  public onMessageBroadcast(cb: BroadcastListener): Disposable {
    this.broadcastListeners.push(cb);
    return new Disposable(() => {
      let index = this.broadcastListeners.indexOf(cb);
      if (index !== -1) {
        this.broadcastListeners.splice(index, 1);
      }
    });
  }

  public handleWebviewMessage(message: WebviewMessage): void {
    // placeholder
    console.log("MLEKO", message);
  }
}
