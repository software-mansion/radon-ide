import { commands, Disposable } from "vscode";
import { disposeAll } from "../../../utilities/disposables";
import { Logger } from "../../../Logger";
import {
  CDPMessage,
  NetworkMethod,
  WebviewCommand,
  WebviewMessage,
} from "../../../network/types/panelMessageProtocol";
import { BaseNetworkInspector } from "./BaseNetworkInspector";

import { NETWORK_EVENTS } from "../../../network/types/panelMessageProtocol";
import { RadonInspectorBridge } from "../../../project/inspectorBridge";
import { NETWORK_EVENT_MAP, NetworkBridge } from "../../../project/networkBridge";
import { ResponseBodyData } from "../../../network/types/network";

// Truncation constants
const MAX_MESSAGE_LENGTH = 1000000;
const TRUNCATED_LENGTH = 1000000;

enum ActivationState {
  Inactive = "inactive",
  Pending = "pending",
  Active = "active",
}

export default class DebuggerNetworkInspector extends BaseNetworkInspector {
  private disposables: Disposable[] = [];
  private activationState = ActivationState.Inactive;

  constructor(
    private readonly inspectorBridge: RadonInspectorBridge,
    private readonly networkBridge: NetworkBridge,
    metroPort: number
  ) {
    super(metroPort);
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
  private formatResponseBodyData(
    responseBodyData: ResponseBodyData,
    contentType: string | undefined
  ): ResponseBodyData {
    const { body, base64Encoded } = responseBodyData;
    if (!body || !contentType) {
      return { body: undefined, wasTruncated: false, base64Encoded: false };
    }

    const shouldDecode = base64Encoded && contentType !== "Image";
    const responseBody = shouldDecode ? this.decodeBase64(body) : body;

    if (responseBody.length > MAX_MESSAGE_LENGTH) {
      return {
        body: responseBody.slice(0, TRUNCATED_LENGTH),
        fullBody: responseBody,
        wasTruncated: true,
        base64Encoded: !shouldDecode,
      };
    }

    return { body: responseBody, fullBody: responseBody, wasTruncated: false, base64Encoded: !shouldDecode };
  }

  private broadcastCDPMessage(message: CDPMessage): void {
    const webviewMessage: WebviewMessage = {
      command: WebviewCommand.CDPCall,
      payload: message,
    };
    this.broadcastMessage(webviewMessage);
  }

  private completeActivation(): void {
    if (this.activationState === ActivationState.Active) {
      return; // activated
    }

    commands.executeCommand("setContext", `RNIDE.Tool.Network.available`, true);
    this.setupNetworkListeners();
    this.networkBridge.enableNetworkInspector();
    this.activationState = ActivationState.Active;
  }

  private setupNetworkListeners(): void {
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

  private setupBridgeAvailableListener(): void {
    const bridgeAvailableSubscription = this.networkBridge.onEvent("bridgeAvailable", () => {
      if (this.activationState === ActivationState.Pending) {
        this.completeActivation();
      }
      bridgeAvailableSubscription.dispose();
    });

    this.disposables.push(bridgeAvailableSubscription);
  }

  private async handleGetResponseBody(payload: CDPMessage) {
    const { messageId } = payload || {};
    const { type } = payload?.params || {};

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
        result: { body: undefined, wasTruncated: false, base64Encoded: false },
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

    const responseBodyResult = this.formatResponseBodyData(responseBodyData, type);

    const message: CDPMessage = {
      messageId,
      method: NetworkMethod.GetResponseBody,
      result: responseBodyResult,
    };

    this.broadcastCDPMessage(message);
  }

  protected handleCDPMessage(message: WebviewMessage & { command: WebviewCommand.CDPCall }): void {
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
    if (this.activationState !== ActivationState.Inactive) {
      return; // activated or activation in progress
    }

    if (!this.pluginAvailable) {
      this.activationState = ActivationState.Pending;
      this.setupBridgeAvailableListener();
      return;
    }

    this.completeActivation();
  }

  public deactivate(): void {
    if (this.activationState === ActivationState.Inactive) {
      return;
    }

    disposeAll(this.disposables);
    this.disposables = [];

    if (this.pluginAvailable) {
      this.networkBridge.disableNetworkInspector();
      commands.executeCommand("setContext", `RNIDE.Tool.Network.available`, false);
    }

    this.activationState = ActivationState.Inactive;
  }

  public dispose(): void {
    disposeAll(this.disposables);
  }

  public get pluginAvailable() {
    return this.networkBridge.bridgeAvailable;
  }
}
