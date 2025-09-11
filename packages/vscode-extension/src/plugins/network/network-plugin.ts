import { commands, Disposable, window } from "vscode";
import { RadonInspectorBridge } from "../../project/bridge";
import { ToolKey, ToolPlugin } from "../../project/tools";
import { extensionContext } from "../../utilities/extensionContext";

import { Logger } from "../../Logger";
import { NetworkDevtoolsWebviewProvider } from "./NetworkDevtoolsWebviewProvider";
import { disposeAll } from "../../utilities/disposables";
import { CDPNetworkCommand } from "../../webview/utilities/communicationTypes";

export const NETWORK_PLUGIN_ID = "network";

let initialized = false;
async function initialize() {
  if (initialized) {
    return;
  }
  Logger.debug("Initilizing Network tool");
  initialized = true;

  const networkDevtoolsWebviewProvider = new NetworkDevtoolsWebviewProvider(extensionContext);

  extensionContext.subscriptions.push(
    networkDevtoolsWebviewProvider,
    window.registerWebviewViewProvider(`RNIDE.Tool.Network.view`, networkDevtoolsWebviewProvider, {
      webviewOptions: { retainContextWhenHidden: true },
    })
  );
}

interface CDPMessage {
  method: string;
  params: unknown;
}

type BroadcastListener = (message: CDPMessage) => void;

export class NetworkPlugin implements ToolPlugin {
  public readonly id: ToolKey = NETWORK_PLUGIN_ID;
  public readonly label = "Network";

  public pluginAvailable = true;
  public toolInstalled = false;
  public readonly persist = true;

  private devtoolsListeners: Disposable[] = [];
  private messageListeners: BroadcastListener[] = [];

  constructor(private readonly inspectorBridge: RadonInspectorBridge) {
    initialize();
  }

  public sendCDPMessage(messageData: CDPMessage) {
    this.inspectorBridge.sendPluginMessage("network", "cdp-message", messageData);
  }

  onMessageBroadcast(cb: BroadcastListener): Disposable {
    // TODO: Check if this should only be exposed to Network or all
    this.messageListeners.push(cb);
    return new Disposable(() => {
      let index = this.messageListeners.indexOf(cb);
      if (index !== -1) {
        this.messageListeners.splice(index, 1);
      }
    });
  }

  activate(): void {
    commands.executeCommand("setContext", `RNIDE.Tool.Network.available`, true);

    this.devtoolsListeners.push(
      this.inspectorBridge.onEvent("pluginMessage", (payload) => {
        if (payload.pluginId === "network") {
          this.messageListeners.forEach((cb) => cb(payload.data));
        }
      })
    );

    this.devtoolsListeners.push(
      this.inspectorBridge.onEvent("appReady", () => {
        this.sendCDPMessage({ method: CDPNetworkCommand.Enable, params: {} });
      })
    );

    this.sendCDPMessage({ method: CDPNetworkCommand.Enable, params: {} });
  }

  deactivate(): void {
    disposeAll(this.devtoolsListeners);
    this.sendCDPMessage({ method: CDPNetworkCommand.Disable, params: {} });
    commands.executeCommand("setContext", `RNIDE.Tool.Network.available`, false);
  }

  openTool(): void {
    commands.executeCommand(`RNIDE.Tool.Network.view.focus`);
  }

  dispose() {
    disposeAll(this.devtoolsListeners);
  }
}
