import { commands, Disposable } from "vscode";
import { NetworkPlugin } from "./network-plugin";
import { disposeAll } from "../../utilities/disposables";
import { WebviewMessage } from "../../network/types/panelMessageProtocol";
import { BaseArchitectureStrategy } from "./BaseArchitectureStrategy";

export default class NewArchitecture extends BaseArchitectureStrategy  {
  private disposables: Disposable[] = [];

  public get pluginAvailable() {
    return this.plugin.networkBridge.bridgeAvailable;
  }

  constructor(private plugin: NetworkPlugin) {
    super();
  }

  private setupListeners() {
    const subscriptions: Disposable[] = [
      this.plugin.networkBridge.onEvent("requestWillBeSent", (payload) => {
        console.log("mleko", payload);
      }),
      this.plugin.networkBridge.onEvent("requestWillBeSentExtraInfo", (payload) => {
        console.log("mleko", payload);
      }),
      this.plugin.networkBridge.onEvent("responseReceived", (payload) => {
        console.log("mleko", payload);
      }),
      this.plugin.networkBridge.onEvent("loadingFinished", (payload) => {
        console.log("mleko", payload);
      }),
      this.plugin.networkBridge.onEvent("enable", () => {
        console.log("mleko", "Network Inspector enabled");
      }),
      this.plugin.networkBridge.onEvent("disable", () => {
        console.log("mleko", "Network Inspector disabled");
      }),
      this.plugin.inspectorBridge.onEvent("appReady", () => {
        this.plugin.networkBridge.enableNetworkInspector();
      }),
    ];
    this.disposables.push(...subscriptions);
  }

  public activate(): void {
    if (!this.pluginAvailable) {
      return;
    }
    commands.executeCommand("setContext", `RNIDE.Tool.Network.available`, true);
    this.setupListeners();
    this.plugin.networkBridge.enableNetworkInspector();
  }

  public deactivate(): void {
    disposeAll(this.disposables);
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
    disposeAll(this.disposables);
  }

  public handleWebviewMessage(message: WebviewMessage): void {
    // placeholder
    console.log("MLEKO", message);
  }
}
