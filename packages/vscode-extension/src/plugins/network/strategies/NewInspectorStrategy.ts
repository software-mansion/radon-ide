import { commands, Disposable } from "vscode";
import { NetworkPlugin } from "../network-plugin";
import { disposeAll } from "../../../utilities/disposables";
import { Logger } from "../../../Logger";
import {
  CDPMessage,
  NetworkMethod,
  WebviewCommand,
  WebviewMessage,
} from "../../../network/types/panelMessageProtocol";
import { BaseInspectorStrategy } from "./BaseInspectorStrategy";

import { NETWORK_EVENTS } from "../../../network/types/panelMessageProtocol";
import { NETWORK_EVENT_MAP, NetworkBridge, RadonInspectorBridge } from "../../../project/bridge";
import { ResponseBodyData } from "../../../network/types/network";

// Truncation constants
const MAX_MESSAGE_LENGTH = 1000000;
const TRUNCATED_LENGTH = 1000000;

export default class NewInspectorStrategy extends BaseInspectorStrategy {
  private disposables: Disposable[] = [];
  private readonly inspectorBridge: RadonInspectorBridge;
  private readonly networkBridge: NetworkBridge;

  constructor(private plugin: NetworkPlugin) {
    super();
    this.networkBridge = this.plugin.networkBridge;
    this.inspectorBridge = this.plugin.inspectorBridge;
  }

  private decodeBase64(base64String: string): string {
    try {
      return Buffer.from(base64String, "base64").toString("utf-8");
    } catch (error) {
      Logger.error("Failed to decode base64 string:", error);
      return "";
    }
  }

  /**
   * Truncate response body if it exceeds the maximum allowed length to prevent UI freezing.
   */
  private truncateResponseBodyData(body: string): ResponseBodyData {
    if (body.length > MAX_MESSAGE_LENGTH) {
      return {
        body: body.slice(0, TRUNCATED_LENGTH),
        wasTruncated: true,
      };
    }

    return { body, wasTruncated: false };
  }

  private broadcastCDPMessage(message: CDPMessage): void {
    const webviewMessage: WebviewMessage = {
      command: WebviewCommand.CDPCall,
      payload: message,
    };
    this.broadcastMessage(webviewMessage);
  }

  private setupListeners() {
    const knownEventsSubscriptions: Disposable[] = NETWORK_EVENTS.map((event) =>
      this.networkBridge.onEvent(NETWORK_EVENT_MAP[event], (message) =>
        this.broadcastCDPMessage(message)
      )
    );

    const subscriptions: Disposable[] = [
      this.networkBridge.onEvent("unknownEvent", (e) => this.broadcastCDPMessage(e)),
      this.inspectorBridge.onEvent("appReady", () => {
        this.networkBridge.enableNetworkInspector();
      }),
    ];

    this.disposables.push(...subscriptions, ...knownEventsSubscriptions);
  }

  private async handleGetResponseBody(payload: CDPMessage) {
    const { messageId } = payload || {};
    if (!messageId) {
      Logger.warn(
        "Could not invoke method getResponseBody: missing messageId (id of webview message sent)"
      );
      return;
    }

    const sendEmptyResponse = () => {
      const emptyMessage: CDPMessage = {
        messageId,
        method: NetworkMethod.GetResponseBody,
        result: { body: undefined, wasTruncated: false },
      };
      this.broadcastCDPMessage(emptyMessage);
    };

    const { requestId } = payload?.params || {};
    if (!requestId) {
      Logger.warn(
        "Could not invoke method getResponseBody: missing requestId (id of actual network request)"
      );
      sendEmptyResponse();
      return;
    }

    const { result: responseBodyData } =
      (await this.networkBridge.getResponseBody(requestId)) || {};

    if (!responseBodyData) {
      Logger.warn("No response body data received");
      sendEmptyResponse();
      return;
    }

    const { body, base64Encoded } = responseBodyData;
    const responseBody = base64Encoded ? this.decodeBase64(body) : body;

    const responseBodyResult = this.truncateResponseBodyData(responseBody);

    const message: CDPMessage = {
      messageId,
      method: NetworkMethod.GetResponseBody,
      result: responseBodyResult,
    };

    this.broadcastCDPMessage(message);
  }

  private handleCDPMessage(message: WebviewMessage & { command: WebviewCommand.CDPCall }): void {
    const { payload } = message;

    switch (payload.method) {
      case NetworkMethod.Enable:
        this.networkBridge.enableNetworkInspector();
        break;
      case NetworkMethod.Disable:
        this.networkBridge.disableNetworkInspector();
        break;
      case NetworkMethod.GetResponseBody:
        this.handleGetResponseBody(payload);
        break;
    }
  }

  public activate(): void {
    if (!this.pluginAvailable) {
      return;
    }
    commands.executeCommand("setContext", `RNIDE.Tool.Network.available`, true);
    this.setupListeners();
    this.networkBridge.enableNetworkInspector();
  }

  public deactivate(): void {
    disposeAll(this.disposables);
    if (!this.pluginAvailable) {
      return;
    }
    this.networkBridge.disableNetworkInspector();
    commands.executeCommand("setContext", `RNIDE.Tool.Network.available`, false);
  }

  public openTool(): void {
    commands.executeCommand(`RNIDE.Tool.Network.view.focus`);
  }

  public dispose(): void {
    disposeAll(this.disposables);
  }

  public handleWebviewMessage(message: WebviewMessage): void {
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

  public get pluginAvailable() {
    return this.plugin.networkBridge.bridgeAvailable;
  }
}
