import { commands, Disposable, window } from "vscode";
import { RadonInspectorBridge } from "../../project/bridge";
import { ToolKey, ToolPlugin } from "../../project/tools";
import { extensionContext } from "../../utilities/extensionContext";

import { Logger } from "../../Logger";
import { NetworkDevtoolsWebviewProvider } from "./NetworkDevtoolsWebviewProvider";
import { disposeAll } from "../../utilities/disposables";
import { openContentInEditor, showDismissableError } from "../../utilities/editorOpeners";

import { RequestData, RequestOptions } from "../../network/types/network";
import {
  WebviewMessage,
  CDPMessage,
  WebviewCommand,
} from "../../network/types/panelMessageProtocol";

type BroadcastListener = (message: WebviewMessage) => void;

export const NETWORK_PLUGIN_ID = "network";

const LANGUAGE_BY_CONTENT_TYPE = {
  "application/json": "json",
  "text/json": "json",
  "text/html": "html",
  "application/xhtml+xml": "html",
  "text/xml": "xml",
  "application/xml": "xml",
  "text/css": "css",
  "text/javascript": "javascript",
  "application/javascript": "javascript",
  "application/x-javascript": "javascript",
  "text/plain": "text",
};

function determineLanguage(contentType: string, body: string): string {
  const contentTypeLowerCase = contentType.toLowerCase();

  for (const [contentTypeKey, language] of Object.entries(LANGUAGE_BY_CONTENT_TYPE)) {
    if (contentTypeLowerCase.includes(contentTypeKey)) {
      return language;
    }
  }

  // Fallback: try to guess based on content structure
  const trimmedBody = body.trim();
  if (trimmedBody.startsWith("<?xml") || trimmedBody.startsWith("<")) {
    return trimmedBody.includes("<!DOCTYPE html") || trimmedBody.includes("<html") ? "html" : "xml";
  }
  if (trimmedBody.startsWith("{") || trimmedBody.startsWith("[")) {
    return "json";
  }

  return "text";
}

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

let initialized = false;
async function initialize() {
  if (initialized) {
    return;
  }
  Logger.debug("Initilizing Network tool");
  initialized = true;

  const networkDevtoolsWebviewProvider = new NetworkDevtoolsWebviewProvider(extensionContext);


  const networkDevtoolsWebviewProvider = new NetworkDevtoolsWebviewProvider(extensionContext);

  extensionContext.subscriptions.push(
    networkDevtoolsWebviewProvider,
    window.registerWebviewViewProvider(`RNIDE.Tool.Network.view`, networkDevtoolsWebviewProvider, {
      webviewOptions: { retainContextWhenHidden: true },
    })
  );
}

export class NetworkPlugin implements ToolPlugin {
  public readonly id: ToolKey = NETWORK_PLUGIN_ID;
  public readonly label = "Network";
  public readonly persist = true;

  public pluginAvailable = true;
  public toolInstalled = false;

  private devtoolsListeners: Disposable[] = [];
  private broadcastListeners: BroadcastListener[] = [];
  private broadcastListeners: BroadcastListener[] = [];

  constructor(private readonly inspectorBridge: RadonInspectorBridge) {
    initialize();
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
      default:
        Logger.warn("Unknown IDE method received");
    }
  }

  handleWebviewMessage(message: WebviewMessage) {
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

  private sendCDPMessage(messageData: CDPMessage) {
    this.inspectorBridge.sendPluginMessage("network", "cdp-message", messageData);
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

  onMessageBroadcast(cb: BroadcastListener): Disposable {
    this.broadcastListeners.push(cb);
    return new Disposable(() => {
      let index = this.broadcastListeners.indexOf(cb);
      if (index !== -1) {
        this.broadcastListeners.splice(index, 1);
      }
    });
  }

  activate(): void {
    commands.executeCommand("setContext", `RNIDE.Tool.Network.available`, true);
    this.setupListeners();
    this.sendCDPMessage({ method: "Network.enable", params: {} });
  }

  deactivate(): void {
    disposeAll(this.devtoolsListeners);
    this.sendCDPMessage({ method: CDPNetworkCommand.Disable, params: {} });
    commands.executeCommand("setContext", `RNIDE.Tool.Network.available`, false);
  }

  public openTool(): void {
    commands.executeCommand(`RNIDE.Tool.Network.view.focus`);
  }

  public dispose(): void {
    disposeAll(this.devtoolsListeners);
  }
}
