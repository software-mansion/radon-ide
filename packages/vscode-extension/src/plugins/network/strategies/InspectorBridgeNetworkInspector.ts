import { commands, Disposable } from "vscode";
import { RadonInspectorBridge } from "../../../project/inspectorBridge";
import { disposeAll } from "../../../utilities/disposables";
import { Logger } from "../../../Logger";
import {
  WebviewMessage,
  CDPMessage,
  WebviewCommand,
  NetworkMethod,
  IDEMessage,
  WebviewMessageDescriptor,
} from "../../../network/types/panelMessageProtocol";
import { BaseNetworkInspector } from "./BaseNetworkInspector";

export default class InspectorBridgeNetworkInspector extends BaseNetworkInspector {
  private devtoolsListeners: Disposable[] = [];

  constructor(
    private readonly inspectorBridge: RadonInspectorBridge,
    metroPort: number
  ) {
    super(metroPort);
  }

  protected handleCDPMessage(message: WebviewMessage & { command: WebviewCommand.CDPCall }): void {
    const { payload } = message;

    if (payload.method.startsWith("Network.")) {
      this.sendCDPMessage(payload);
    } else {
      Logger.warn("Unknown CDP method received");
    }
  }

  private sendCDPMessage(messageData: CDPMessage) {
    this.inspectorBridge.sendPluginMessage(
      "network",
      WebviewMessageDescriptor.CDPMessage,
      messageData
    );
  }

  /**
   * Parse CDPMessage into WebviewMessage format and broadcast to all listeners
   */
  private storeAndBroadcastWebviewMessage(
    message: string,
    command: WebviewCommand = WebviewCommand.CDPCall
  ): void {
    try {
      const webviewMessage: WebviewMessage = {
        command: command,
        payload: JSON.parse(message),
      };
      this.storeMessage(webviewMessage);
      this.broadcastMessage(webviewMessage);
    } catch {
      console.error("Failed to parse Webview message:", message);
    }
  }

  protected async handleGetResponseBodyData(message: IDEMessage): Promise<void> {
    const { messageId, params } = message;
    this.sendCDPMessage({
      messageId,
      method: NetworkMethod.GetResponseBody,
      params: {
        requestId: params?.requestId,
      },
    });
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
          if (payload.type === WebviewMessageDescriptor.IDEMessage) {
            this.storeAndBroadcastWebviewMessage(payload.data, WebviewCommand.IDECall);
          } else {
            this.storeAndBroadcastWebviewMessage(payload.data, WebviewCommand.CDPCall);
          }
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

  public dispose(): void {
    disposeAll(this.devtoolsListeners);
  }

  public get pluginAvailable() {
    return true;
  }
}
