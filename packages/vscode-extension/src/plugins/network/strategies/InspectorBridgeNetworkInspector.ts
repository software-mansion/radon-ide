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
  IDEMethod,
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
   * Method overload for InspectorBridgeNetworkInspector implementation.
   * Apart from changing the tracking state, send message to application (network.js)
   * with appropriate IDEMethod, to start/stop network response buffering.
   */
  protected setNetworkTracking(shouldTrack: boolean): void {
    super.setNetworkTracking(shouldTrack);

    const method = shouldTrack ? IDEMethod.StartNetworkTracking : IDEMethod.StopNetworkTracking;
    this.inspectorBridge.sendPluginMessage("network", WebviewMessageDescriptor.IDEMessage, {
      method,
    });
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
          try {
            const payloadData = JSON.parse(payload.data);

            if (payload.type === WebviewMessageDescriptor.IDEMessage) {
              this.broadcastMessage(payloadData, WebviewCommand.IDECall);
            } else {
              this.broadcastMessage(payloadData, WebviewCommand.CDPCall);
            }
          } catch (error) {
            console.error("Failed to parse Webview message:", payload.data);
          }
        }
      })
    );

    // Enable network monitoring when app is ready
    this.devtoolsListeners.push(
      this.inspectorBridge.onEvent("appReady", () => {
        this.sendCDPMessage({ method: NetworkMethod.Enable, params: {} });

        // Clear any stored messages in the panel and plugin state
        this.broadcastMessage({ method: IDEMethod.ClearStoredMessages }, WebviewCommand.IDECall);
        this.clearNetworkMessages();
      })
    );
  }

  public enable(): void {
    commands.executeCommand("setContext", `RNIDE.Tool.Network.available`, true);
    this.setupListeners();
    this.sendCDPMessage({ method: NetworkMethod.Enable, params: {} });
  }

  /**
   * "Soft" disable by default, deactivates without clearing messages to preserve state across reactivation
   */
  public deactivate(shouldDisableNetworkInspector: boolean = false): void {
    disposeAll(this.devtoolsListeners);
    commands.executeCommand("setContext", `RNIDE.Tool.Network.available`, false);
  }

  public disable(): void {
    this.deactivate(true);
    this.sendCDPMessage({ method: NetworkMethod.Disable, params: {} });
    this.clearNetworkMessages();
  }

  public dispose(): void {
    disposeAll(this.devtoolsListeners);
  }

  public get pluginAvailable() {
    return true;
  }
}
