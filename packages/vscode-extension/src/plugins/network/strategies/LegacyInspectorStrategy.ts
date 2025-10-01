import { commands, Disposable } from "vscode";
import { NetworkPlugin } from "../network-plugin";
import { RadonInspectorBridge } from "../../../project/bridge";
import { disposeAll } from "../../../utilities/disposables";
import { Logger } from "../../../Logger";
import {
  WebviewMessage,
  CDPMessage,
  WebviewCommand,
  NetworkMethod,
} from "../../../network/types/panelMessageProtocol";
import { BaseInspectorStrategy } from "./BaseInspectorStrategy";

export default class LegacyInspectorStrategy extends BaseInspectorStrategy {
  private devtoolsListeners: Disposable[] = [];

  private readonly inspectorBridge: RadonInspectorBridge;

  constructor(private plugin: NetworkPlugin) {
    super();
    this.inspectorBridge = this.plugin.inspectorBridge;
  }

  private handleCDPMessage(message: WebviewMessage & { command: WebviewCommand.CDPCall }): void {
    const { payload } = message;

    if (payload.method.startsWith("Network.")) {
      this.sendCDPMessage(payload);
    } else {
      Logger.warn("Unknown CDP method received");
    }
  }

  private sendCDPMessage(messageData: CDPMessage) {
    this.inspectorBridge.sendPluginMessage("network", "cdp-message", messageData);
  }

  /**
   * Parse CDPMessage into WebviewMessage format and broadcast to all listeners
   */
  private broadcastCDPMessage(message: string) {
    try {
      const webviewMessage: WebviewMessage = {
        command: WebviewCommand.CDPCall,
        payload: JSON.parse(message),
      };
      this.broadcastMessage(webviewMessage);
    } catch {
      console.error("Failed to parse CDP message:", message);
    }
  }

  /**
   * All pluginMessages sent to the panel follow @type {WebviewMessage} format:
   *
   * Message Flow:
   * - React Native app sends network events (requests, responses) via inspector bridge
   * - Bridge forwards messages to this plugin with pluginId: "network"
   * - Plugin transforms bridge messages into WebviewMessage format
   * - Messages are broadcasted via WebSocket to all connected NetworkPanel clients
   */
  private setupListeners() {
    // Broadcast network messages from the app to Network Panel Webview
    this.devtoolsListeners.push(
      this.inspectorBridge.onEvent("pluginMessage", (payload) => {
        if (payload.pluginId === "network") {
          this.broadcastCDPMessage(payload.data);
        }
      })
    );

    // Enable network monitoring when app is ready
    this.devtoolsListeners.push(
      this.inspectorBridge.onEvent("appReady", () => {
        this.sendCDPMessage({ method: NetworkMethod.Enable, params: {} });
      })
    );
  }

  public handleWebviewMessage(message: WebviewMessage) {
    try {
      switch (message.command) {
        case WebviewCommand.CDPCall:
          this.handleCDPMessage(message);
          break;
        case WebviewCommand.IDECall:
          this.handleIDEMessage(message);
          break;
        default:
          Logger.warn("Unknown message type received");
      }
    } catch (error) {
      Logger.error("Invalid WebSocket message format:", error);
    }
  }

  public activate(): void {
    commands.executeCommand("setContext", `RNIDE.Tool.Network.available`, true);
    this.setupListeners();
    this.sendCDPMessage({ method: NetworkMethod.Enable, params: {} });
  }

  public deactivate(): void {
    disposeAll(this.devtoolsListeners);
    this.sendCDPMessage({ method: NetworkMethod.Disable, params: {} });
    commands.executeCommand("setContext", `RNIDE.Tool.Network.available`, false);
  }

  public openTool(): void {
    commands.executeCommand(`RNIDE.Tool.Network.view.focus`);
  }

  public dispose(): void {
    disposeAll(this.devtoolsListeners);
  }

  public get pluginAvailable() {
    return true;
  }
}
