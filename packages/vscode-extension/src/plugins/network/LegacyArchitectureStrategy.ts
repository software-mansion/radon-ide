import { commands, Disposable } from "vscode";
import { ArchitectureStrategy, NetworkPlugin, BroadcastListener } from "./network-plugin";
import { RadonInspectorBridge } from "../../project/bridge";
import { disposeAll } from "../../utilities/disposables";
import { Logger } from "../../Logger";
import { openContentInEditor, showDismissableError } from "../../utilities/editorOpeners";
import { determineLanguage } from "../../network/utils/requestFormatters";
import { extractTheme } from "../../utilities/themeExtractor";
import {
  WebviewMessage,
  CDPMessage,
  WebviewCommand,
  IDEMessage,
} from "../../network/types/panelMessageProtocol";
import { RequestData, RequestOptions } from "../../network/types/network";

function formatDataBasedOnLanguage(body: string, language: string): string {
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

export default class LegacyArchitecture implements ArchitectureStrategy {
  private devtoolsListeners: Disposable[] = [];
  private broadcastListeners: BroadcastListener[] = [];

  private readonly inspectorBridge: RadonInspectorBridge;

  constructor(private plugin: NetworkPlugin) {
    this.inspectorBridge = this.plugin.inspectorBridge;
  }

  public get pluginAvailable() {
    return true;
  }

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
      const formattedData = formatDataBasedOnLanguage(responseBody, language);

      openContentInEditor(formattedData, language);
    } catch (error) {
      Logger.error("Failed to fetch response body:", error);
      showDismissableError("Could not fetch response data.");
    }
  }

  private async handleGetTheme(message: IDEMessage) {
    const { id, params } = message;
    const { themeDescriptor } = params || {};
    const theme = extractTheme(themeDescriptor);
    this.sendIDEMessage({ method: "IDE.Theme", id, result: theme });
  }

  private handleCDPMessage(message: WebviewMessage & { command: WebviewCommand.CDPCall }): void {
    const { payload } = message;

    if (payload.method.startsWith("Network.")) {
      this.sendCDPMessage(payload);
    } else {
      Logger.warn("Unknown CDP method received");
    }
  }

  private handleIDEMessage(message: WebviewMessage & { command: WebviewCommand.IDECall }): void {
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

  private sendCDPMessage(messageData: CDPMessage) {
    this.inspectorBridge.sendPluginMessage("network", "cdp-message", messageData);
  }

  private sendIDEMessage(payload: IDEMessage) {
    const message: WebviewMessage = {
      command: WebviewCommand.IDECall,
      payload,
    };
    this.broadcastListeners.forEach((cb) => cb(message));
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
      this.broadcastListeners.forEach((cb) => cb(webviewMessage));
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
        this.sendCDPMessage({ method: "Network.enable", params: {} });
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

  public onMessageBroadcast(cb: BroadcastListener): Disposable {
    this.broadcastListeners.push(cb);
    return new Disposable(() => {
      let index = this.broadcastListeners.indexOf(cb);
      if (index !== -1) {
        this.broadcastListeners.splice(index, 1);
      }
    });
  }

  public activate(): void {
    commands.executeCommand("setContext", `RNIDE.Tool.Network.available`, true);
    this.setupListeners();
    this.sendCDPMessage({ method: "Network.enable", params: {} });
  }

  public deactivate(): void {
    disposeAll(this.devtoolsListeners);
    this.sendCDPMessage({ method: "Network.disable", params: {} });
    commands.executeCommand("setContext", `RNIDE.Tool.Network.available`, false);
  }

  public openTool(): void {
    commands.executeCommand(`RNIDE.Tool.Network.view.focus`);
  }

  public dispose(): void {
    disposeAll(this.devtoolsListeners);
  }
}
