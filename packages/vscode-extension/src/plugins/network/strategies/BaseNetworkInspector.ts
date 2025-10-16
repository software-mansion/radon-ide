import { Disposable } from "vscode";
import { NetworkInspector, BroadcastListener } from "../network-plugin";
import {
  WebviewMessage,
  IDEMessage,
  WebviewCommand,
  IDEMethod,
} from "../../../network/types/panelMessageProtocol";
import { RequestData, RequestOptions } from "../../../network/types/network";
import { Logger } from "../../../Logger";
import { determineLanguage } from "../../../network/utils/requestFormatters";
import { openContentInEditor, showDismissableError } from "../../../utilities/editorOpeners";
import { extractTheme } from "../../../utilities/themeExtractor";
import { ContentTypeHeader } from "../../../network/types/network";

export abstract class BaseNetworkInspector implements NetworkInspector {
  protected broadcastListeners: BroadcastListener[] = [];

  // #region abstract

  public abstract activate(): void;
  public abstract deactivate(): void;
  public abstract dispose(): void;
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

  protected broadcastMessage(message: Parameters<BroadcastListener>[0]): void {
    this.broadcastListeners.forEach((cb) => cb(message));
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
    const message: WebviewMessage = {
      command: WebviewCommand.IDECall,
      payload,
    };
    this.broadcastMessage(message);
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
    base64Encoded: boolean | undefined
  ): Promise<void> {
    if (!requestData || !base64Encoded) {
      Logger.warn("fetchFullResponseBody called without proper parameters");
      return;
    }

    try {
      const response = await this.fetchResponse(requestData);
      const contentType =
        response.headers.get(ContentTypeHeader.IOS) ||
        response.headers.get(ContentTypeHeader.ANDROID) ||
        "";

      const responseBody = base64Encoded
        ? await this.responseToBase64(response)
        : await response.text();

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
   * Handle IDE messages from webview
   */
  protected handleIDEMessage(message: WebviewMessage & { command: WebviewCommand.IDECall }): void {
    const { payload } = message;

    switch (payload.method) {
      case IDEMethod.FetchFullResponseBody:
        const { request, base64Encoded } = payload.params || {};
        this.handleFetchFullResponseBody(request, base64Encoded);
        break;
      case IDEMethod.GetTheme:
        this.handleGetTheme(payload);
        break;
      default:
        Logger.warn("Unknown IDE method received");
    }
  }

  // #endregion
}
