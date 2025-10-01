import { Disposable } from "vscode";
import { InspectorStrategy, BroadcastListener } from "../network-plugin";
import {
  WebviewMessage,
  IDEMessage,
  WebviewCommand,
} from "../../../network/types/panelMessageProtocol";
import { RequestData, RequestOptions } from "../../../network/types/network";
import { Logger } from "../../../Logger";
import { determineLanguage } from "../../../network/utils/requestFormatters";
import { openContentInEditor, showDismissableError } from "../../../utilities/editorOpeners";
import { extractTheme } from "../../../utilities/themeExtractor";

export abstract class BaseInspectorStrategy implements InspectorStrategy {
  protected broadcastListeners: BroadcastListener[] = [];

  // #region abstract

  abstract activate(): void;
  abstract deactivate(): void;
  abstract openTool(): void;
  abstract dispose(): void;
  abstract handleWebviewMessage(message: WebviewMessage): void;
  abstract readonly pluginAvailable: boolean;

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

  //#endregion

  // #region IDE messages

  private sendIDEMessage(payload: IDEMessage): void {
    const message: WebviewMessage = {
      command: WebviewCommand.IDECall,
      payload,
    };
    this.broadcastMessage(message);
  }

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

  /**
   * Handle fetching full response body and opening it in editor
   */
  private async handleFetchFullResponseBody(requestData: RequestData | undefined): Promise<void> {
    if (!requestData) {
      Logger.warn("fetchFullResponseBody called without request data");
      return;
    }

    try {
      const response = await this.fetchResponse(requestData);
      const contentType = response.headers.get("content-type") || "";
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
    this.sendIDEMessage({ method: "IDE.Theme", messageId: id, result: theme });
  }

  /**
   * Handle IDE messages from webview
   */
  protected handleIDEMessage(message: WebviewMessage & { command: WebviewCommand.IDECall }): void {
    const { payload } = message;

    switch (payload.method) {
      case "IDE.fetchFullResponseBody":
        this.handleFetchFullResponseBody(payload.params?.request);
        break;
      case "IDE.getTheme":
        this.handleGetTheme(payload);
        break;
      default:
        Logger.warn("Unknown IDE method received");
    }
  }

  // #endregion
}
