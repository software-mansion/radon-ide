import { Disposable } from "vscode";
import { NetworkInspector, BroadcastListener } from "../network-plugin";
import {
  WebviewMessage,
  IDEMessage,
  WebviewCommand,
  IDEMethod,
  CDPMessage,
} from "../../../network/types/panelMessageProtocol";
import { RequestData, RequestOptions } from "../../../network/types/network";
import { Logger } from "../../../Logger";
import {
  determineLanguage,
  getNetworkResponseContentType,
} from "../../../network/utils/requestFormatters";
import { openContentInEditor, showDismissableError } from "../../../utilities/editorOpeners";
import { extractTheme } from "../../../utilities/themeExtractor";

export abstract class BaseNetworkInspector implements NetworkInspector {
  protected broadcastListeners: BroadcastListener[] = [];
  private networkMessages: WebviewMessage[] = [];
  private trackingEnabled: boolean = true;

  constructor(private readonly metroPort: number) {}

  // #region abstract

  public abstract activate(): void;
  public abstract deactivate(): void;
  public abstract dispose(): void;
  public abstract suspend(): void;
  protected abstract handleGetResponseBodyData(payload: IDEMessage): Promise<void>;
  protected abstract handleCDPMessage(
    message: WebviewMessage & { command: WebviewCommand.CDPCall }
  ): void;
  public abstract readonly pluginAvailable: boolean;

  // #endregion

  // #region common

  public onMessageBroadcast(cb: BroadcastListener): Disposable {
    this.broadcastListeners.push(cb);
    return new Disposable(() => {
      let index = this.broadcastListeners.indexOf(cb);
      if (index !== -1) {
        this.broadcastListeners.splice(index, 1);
      }
    });
  }

  private isInternalRequest(message: WebviewMessage): boolean {
    if (message.command !== WebviewCommand.CDPCall) {
      return false;
    }

    const url = message?.payload.params?.request?.url ?? "";

    try {
      const parsedUrl = new URL(url);
      const isLocalhost = parsedUrl.hostname === "localhost" || parsedUrl.hostname === "127.0.0.1";
      const isAndroidHost = parsedUrl.hostname === "10.0.2.2";
      const isPortMatch = parsedUrl.port === this.metroPort.toString();

      return (isLocalhost || isAndroidHost) && isPortMatch;
    } catch (error) {
      return false;
    }
  }

  private shouldTrackMessage(message: WebviewMessage): boolean {
    return this.trackingEnabled || message.command === WebviewCommand.IDECall;
  }

  protected changeNetworkTracking(shouldTrack: boolean): void {
    this.trackingEnabled = shouldTrack;
  }

  protected clearNetworkMessages(): void {
    this.networkMessages = [];
  }

  protected broadcastMessage(payload: CDPMessage | IDEMessage, command: WebviewCommand): void {
    const message: WebviewMessage = {
      command: command,
      payload: payload,
    } as WebviewMessage;

    if (!this.shouldTrackMessage(message)) {
      return;
    }
    if (this.isInternalRequest(message)) {
      Logger.info(`Http request to metro filtered out: ${message.payload.params?.request?.url}`);
      return;
    }

    if (command !== WebviewCommand.IDECall) {
      this.networkMessages.push(message);
    }

    this.broadcastListeners.forEach((cb) => cb(message));
  }

  // protected storeAndBroadcastWebviewMessage(
  //   message: IDEMessage,
  //   command: WebviewCommand.IDECall
  // ): void;
  // protected storeAndBroadcastWebviewMessage(
  //   message: CDPMessage,
  //   command: WebviewCommand.CDPCall
  // ): void;
  // protected storeAndBroadcastWebviewMessage(
  //   message: IDEMessage | CDPMessage,
  //   command: WebviewCommand.IDECall | WebviewCommand.CDPCall
  // ): void {
  //   const webviewMessage: WebviewMessage = {
  //     command: command,
  //     payload: message,
  //   } as WebviewMessage;

  //   const shouldSaveMessage =
  //     this.shouldTrackMessage(webviewMessage) && !this.isInternalRequest(webviewMessage);

  //   if (shouldSaveMessage) {
  //     this.networkMessages.push(webviewMessage);
  //   }

  //   this.broadcastMessage(webviewMessage);
  // }

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

  //#endregion

  // #region IDE messages
  private formatDataBasedOnLanguage(body: string, language: string): string {
    if (language === "json") {
      try {
        const parsed = JSON.parse(body);
        return JSON.stringify(parsed, null, 2);
      } catch {
        // If JSON parsing fails, return original body
      }
    }
    return body;
  }

  private sendIDEMessage(payload: IDEMessage): void {
    this.broadcastMessage(payload, WebviewCommand.IDECall);
  }

  /**
   * Fetch response from the network
   */
  private async fetchResponse(requestData: RequestData): Promise<Response> {
    const fetchOptions: RequestOptions = {
      method: requestData.method,
      headers: requestData.headers || {},
    };

    if (requestData.postData) {
      fetchOptions.body = requestData.postData;
    }

    return fetch(requestData.url, fetchOptions);
  }

  private async responseToBase64(response: Response): Promise<string> {
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return buffer.toString("base64");
  }

  /**
   * Handle fetching full response body and opening it in editor
   */
  private async handleFetchFullResponseBody(
    requestData: RequestData | undefined,
    base64Encoded: boolean = false
  ): Promise<void> {
    if (!requestData) {
      Logger.warn("fetchFullResponseBody called without proper parameters");
      return;
    }

    try {
      const response = await this.fetchResponse(requestData);
      const contentType = getNetworkResponseContentType(response);

      if (base64Encoded) {
        const responseBody = await this.responseToBase64(response);
        openContentInEditor(responseBody, "plaintext");
        return;
      }

      const responseBody = await response.text();
      const language = determineLanguage(contentType, responseBody);
      const formattedData = this.formatDataBasedOnLanguage(responseBody, language);

      openContentInEditor(formattedData, language);
    } catch (error) {
      Logger.error("Failed to fetch response body:", error);
      showDismissableError("Could not fetch response data.");
    }
  }

  /**
   * Handle get theme request from webview
   */
  private async handleGetTheme(message: IDEMessage): Promise<void> {
    const { messageId: id, params } = message;
    const { themeDescriptor } = params || {};
    const theme = extractTheme(themeDescriptor);
    this.sendIDEMessage({ method: IDEMethod.Theme, messageId: id, result: theme });
  }

  /**
   * Handle get session data request from webview
   * (network messages history and tracking status synchronisation)
   */
  private async handleGetSessionData(message: IDEMessage): Promise<void> {
    const { messageId } = message;
    this.sendIDEMessage({
      method: IDEMethod.SessionData,
      messageId,
      result: {
        networkMessages: this.networkMessages,
        shouldTrackNetwork: this.trackingEnabled,
      },
    });
  }
  /**
   * Handle IDE messages from webview
   */
  protected handleIDEMessage(message: WebviewMessage & { command: WebviewCommand.IDECall }): void {
    const { payload } = message;

    switch (payload.method) {
      case IDEMethod.FetchFullResponseBody:
        const { request, base64Encoded } = payload.params || {};
        this.handleFetchFullResponseBody(request, base64Encoded);
        break;
      case IDEMethod.GetResponseBodyData:
        this.handleGetResponseBodyData(payload);
        break;
      case IDEMethod.GetTheme:
        this.handleGetTheme(payload);
        break;
      case IDEMethod.GetSessionData:
        this.handleGetSessionData(payload);
        break;
      case IDEMethod.StartNetworkTracking:
        this.changeNetworkTracking(true);
        break;
      case IDEMethod.StopNetworkTracking:
        this.changeNetworkTracking(false);
        break;
      case IDEMethod.ClearStoredMessages:
        this.clearNetworkMessages();
        break;
      default:
        Logger.warn("Unknown IDE method received");
    }
  }

  // #endregion
}
