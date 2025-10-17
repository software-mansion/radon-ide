import { commands, Disposable } from "vscode";
import { disposeAll } from "../../../utilities/disposables";
import { Logger } from "../../../Logger";
import {
  CDPMessage,
  IDEMessage,
  IDEMethod,
  NetworkMethod,
  WebviewCommand,
  WebviewMessage,
} from "../../../network/types/panelMessageProtocol";
import { BaseNetworkInspector } from "./BaseNetworkInspector";

import { NETWORK_EVENTS } from "../../../network/types/panelMessageProtocol";
import { RadonInspectorBridge } from "../../../project/inspectorBridge";
import { NETWORK_EVENT_MAP, NetworkBridge } from "../../../project/networkBridge";
import {
  ResponseBody,
  ResponseBodyData,
  ResponseBodyDataType,
} from "../../../network/types/network";

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
    responseBodyData: ResponseBody,
    type: ResponseBodyDataType
  ): ResponseBodyData {
    const { body, base64Encoded } = responseBodyData;
    const isImage = type === ResponseBodyDataType.Image;

    if (!body) {
      return {
        body: undefined,
        wasTruncated: false,
        base64Encoded: false,
        type: ResponseBodyDataType.Other,
      };
    }

    const shouldDecode = base64Encoded && !isImage;
    const responseBody = shouldDecode ? this.decodeBase64(body) : body;
    const isResponseBase64Encoded = base64Encoded && !shouldDecode;

    if (responseBody.length > MAX_MESSAGE_LENGTH) {
      return {
        body: responseBody.slice(0, TRUNCATED_LENGTH),
        fullBody: responseBody,
        wasTruncated: true,
        base64Encoded: isResponseBase64Encoded,
        type,
      };
    }

    return {
      body: responseBody,
      fullBody: responseBody,
      wasTruncated: false,
      base64Encoded: isResponseBase64Encoded,
      type,
    };
  }

  private broadcastWebviewMessage(message: IDEMessage, command: WebviewCommand.IDECall): void;
  private broadcastWebviewMessage(message: CDPMessage, command: WebviewCommand.CDPCall): void;
  private broadcastWebviewMessage(
    message: IDEMessage | CDPMessage,
    command: WebviewCommand.IDECall | WebviewCommand.CDPCall
  ): void {
    const webviewMessage: WebviewMessage = {
      command: command,
      payload: message,
    } as WebviewMessage;
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
        this.broadcastWebviewMessage(message, WebviewCommand.CDPCall)
      )
    );

    const subscriptions: Disposable[] = [
      this.networkBridge.onEvent("unknownEvent", (e) =>
        this.broadcastWebviewMessage(e, WebviewCommand.IDECall)
      ),
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

  protected async handleGetResponseBodyData(payload: IDEMessage) {
    const { messageId } = payload || {};
    const { type } = payload?.params || {};

    if (!messageId) {
      Logger.warn(
        "Could not invoke method getResponseBody: missing messageId (id of webview message sent)"
      );
      return;
    }

    const sendEmptyResponse = () => {
      const emptyMessage: IDEMessage = {
        messageId,
        method: IDEMethod.GetResponseBodyData,
        result: {
          body: undefined,
          wasTruncated: false,
          base64Encoded: false,
          type: ResponseBodyDataType.Other,
        },
      };
      this.broadcastWebviewMessage(emptyMessage, WebviewCommand.IDECall);
    };

    const { requestId } = payload?.params || {};
    if (!requestId) {
      Logger.warn(
        "Could not invoke method getResponseBody: missing requestId (id of actual network request)"
      );
      sendEmptyResponse();
      return;
    }

    const { result: responseBody } = (await this.networkBridge.getResponseBody(requestId)) || {};

    if (!responseBody) {
      Logger.warn("No response body data received");
      sendEmptyResponse();
      return;
    }

    const responseBodyData = this.formatResponseBodyData(responseBody, type ?? ResponseBodyDataType.Other);

    const message: IDEMessage = {
      messageId,
      method: IDEMethod.GetResponseBodyData,
      result: responseBodyData,
    };

    this.broadcastWebviewMessage(message, WebviewCommand.IDECall);
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
