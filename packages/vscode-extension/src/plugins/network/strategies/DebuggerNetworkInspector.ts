import { commands, Disposable } from "vscode";
import { disposeAll } from "../../../utilities/disposables";
import { Logger } from "../../../Logger";
import {
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

enum ActivationState {
  Inactive = "inactive",
  Pending = "pending",
  Active = "active",
  JsDebuggerDisconnected = "jsDebuggerDisconnected",
}

// Truncation constants
const MAX_MESSAGE_LENGTH = 1000000;
const TRUNCATED_LENGTH = 1000000;

// Default ResponseBodyData

const DEFAULT_RESPONSE_BODY_DATA: ResponseBodyData = {
  body: undefined,
  wasTruncated: false,
  base64Encoded: false,
  type: ResponseBodyDataType.Other,
};

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
   * Parse and optionally truncate response body if it exceeds the maximum allowed length to prevent UI freezing.
   * Base64-encoded images are kept as-is, while other base64 content is decoded.
   */
  private parseResponseBodyData(
    responseBody: ResponseBody,
    type: ResponseBodyDataType
  ): ResponseBodyData {
    const { body, base64Encoded } = responseBody;

    if (!body) {
      return DEFAULT_RESPONSE_BODY_DATA;
    }

    const isImage = type === ResponseBodyDataType.Image;

    const shouldDecodeBase64 = base64Encoded && !isImage;
    const parsedBody = shouldDecodeBase64 ? this.decodeBase64(body) : body;

    const shouldKeepBase64Encoding = base64Encoded && !shouldDecodeBase64;
    const shouldTruncate = parsedBody.length > MAX_MESSAGE_LENGTH;

    return {
      body: shouldTruncate ? parsedBody.slice(0, TRUNCATED_LENGTH) : parsedBody,
      fullBody: parsedBody,
      wasTruncated: shouldTruncate,
      base64Encoded: shouldKeepBase64Encoding,
      type,
    };
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
      this.networkBridge.onEvent(NETWORK_EVENT_MAP[event], (message) => {
        this.broadcastMessage(message, WebviewCommand.CDPCall);
      })
    );

    const subscriptions: Disposable[] = [
      this.networkBridge.onEvent("unknownEvent", (e) =>
        this.broadcastMessage(e, WebviewCommand.CDPCall)
      ),
      this.inspectorBridge.onEvent("appReady", () => {
        this.networkBridge.enableNetworkInspector();
      }),
    ];

    this.disposables.push(...subscriptions, ...knownEventsSubscriptions);
  }

  private handleJsDebuggerConnected(): void {
    if (this.activationState === ActivationState.Pending) {
      this.completeActivation();
    }

    if (this.activationState === ActivationState.JsDebuggerDisconnected) {
      // send Network.Enable method again to re-enable
      // network-events reporting through js debugger
      this.networkBridge.enableNetworkInspector();
      this.activationState = ActivationState.Active;
    }
  }

  private handleJsDebuggerDisconnected(): void {
    if (this.activationState === ActivationState.Active) {
      this.activationState = ActivationState.JsDebuggerDisconnected;
    }
  }

  private setupDebuggerConnectionListeners(): void {
    const debuggerConnectionSubscriptions: Disposable[] = [
      this.networkBridge.onEvent("jsDebuggerConnected", () => this.handleJsDebuggerConnected()),
      this.networkBridge.onEvent("jsDebuggerDisconnected", () =>
        this.handleJsDebuggerDisconnected()
      ),
    ];

    this.disposables.push(...debuggerConnectionSubscriptions);
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
        method: IDEMethod.ResponseBodyData,
        result: DEFAULT_RESPONSE_BODY_DATA,
      };
      this.broadcastMessage(emptyMessage, WebviewCommand.IDECall);
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

    const responseBodyData = this.parseResponseBodyData(
      responseBody,
      type ?? ResponseBodyDataType.Other
    );

    const message: IDEMessage = {
      messageId,
      method: IDEMethod.ResponseBodyData,
      result: responseBodyData,
    };

    this.broadcastMessage(message, WebviewCommand.IDECall);
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

  public enable(): void {
    if (this.activationState !== ActivationState.Inactive) {
      return; // enabled or activation in progress
    }

    this.setupDebuggerConnectionListeners();

    if (!this.pluginAvailable) {
      this.activationState = ActivationState.Pending;
      return;
    }

    this.completeActivation();
  }

  /**
   * "Soft" disable by default, deactivates without clearing messages to preserve state across reactivation
   */
  public deactivate(): void {
    if (this.activationState === ActivationState.Inactive) {
      return;
    }

    disposeAll(this.disposables);
    this.disposables = [];

    if (this.pluginAvailable) {
      commands.executeCommand("setContext", `RNIDE.Tool.Network.available`, false);
    }

    this.activationState = ActivationState.Inactive;
  }

  public disable(): void {
    this.deactivate();
    this.networkBridge.disableNetworkInspector();
    this.clearNetworkMessages();
  }

  public dispose(): void {
    disposeAll(this.disposables);
  }

  public get pluginAvailable() {
    return this.networkBridge.bridgeAvailable;
  }
}
