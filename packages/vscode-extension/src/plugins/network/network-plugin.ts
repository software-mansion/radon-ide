import http, { Server } from "http";
import { commands, Disposable, window } from "vscode";
import { WebSocketServer, WebSocket } from "ws";
import { RadonInspectorBridge } from "../../project/bridge";
import { ToolKey, ToolPlugin } from "../../project/tools";
import { extensionContext } from "../../utilities/extensionContext";

import { Logger } from "../../Logger";
import { NetworkDevtoolsWebviewProvider } from "./NetworkDevtoolsWebviewProvider";
import { disposeAll } from "../../utilities/disposables";
import { openContentInEditor, showDismissableError } from "../../utilities/editorOpeners";

import { RequestData, RequestOptions } from "../../network/types/network";
import {
  NetworkPanelMessage,
  IDEMessage,
  CDPMessage,
} from "../../network/types/panelMessageProtocol";

interface WebSocketMessageData {
  toString(): string;
}

export const NETWORK_PLUGIN_ID = "network";
const DEVTOOLS_CDP_MESSAGE_ID = "cdp-message";

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
  extensionContext.subscriptions.push(
    window.registerWebviewViewProvider(
      `RNIDE.Tool.Network.view`,
      new NetworkDevtoolsWebviewProvider(extensionContext),
      { webviewOptions: { retainContextWhenHidden: true } }
    )
  );
}

class NetworkCDPWebsocketBackend implements Disposable {
  private server: Server;
  private sessions: Set<WebSocket> = new Set();

  constructor(private readonly sendCDPMessage: (messageData: CDPMessage | IDEMessage) => void) {
    this.server = http.createServer(() => {});
    this.setupWebSocketServer();
  }

  private setupWebSocketServer(): void {
    const wss = new WebSocketServer({ server: this.server });

    wss.on("connection", (ws) => {
      this.sessions.add(ws);

      ws.on("message", (message) => {
        this.handleWebSocketMessage(message, ws);
      });

      ws.on("close", () => {
        this.sessions.delete(ws);
      });
    });
  }

  private async handleWebSocketMessage(
    message: WebSocketMessageData,
    ws: WebSocket
  ): Promise<void> {
    try {
      const parsedMessage: NetworkPanelMessage = JSON.parse(message.toString());

      switch (parsedMessage.type) {
        case "CDP":
          this.handleCDPMessage(parsedMessage as NetworkPanelMessage & { type: "CDP" }, ws);
          break;
        case "IDE":
          this.handleIDEMessage(parsedMessage as NetworkPanelMessage & { type: "IDE" }, ws);
          break;
        default:
          Logger.warn("Unknown message type received");
      }
    } catch (error) {
      Logger.error("Invalid WebSocket message format:", error);
    }
  }

  private handleCDPMessage(message: NetworkPanelMessage & { type: "CDP" }, ws: WebSocket): void {
    const { payload } = message;

    if (payload.method.startsWith("Network.")) {
      this.sendCDPMessage(payload);
    } else {
      Logger.warn("Unknown CDP method received");
      this.sendGenericResponse(message, ws);
    }
  }

  private handleIDEMessage(message: NetworkPanelMessage & { type: "IDE" }, ws: WebSocket): void {
    const { payload } = message;

    switch (payload.method) {
      case "IDE.fetchFullResponseBody":
        this.handleFetchFullResponseBody(payload.params?.request);
        break;
      default:
        Logger.warn("Unknown IDE method received");
        this.sendGenericResponse(message, ws);
    }
  }

  private sendGenericResponse(message: NetworkPanelMessage, ws: WebSocket): void {
    const { type, payload } = message;

    if (!payload.id) {
      return;
    }
    const responsePayload = {
      id: payload.id,
      method: payload.method,
      result: {},
    };

    const response = {
      type,
      payload: responsePayload,
    };

    ws.send(JSON.stringify(response));
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

  public get port(): number {
    const address = this.server.address();
    Logger.debug("Server address:", address);

    if (address && typeof address === "object") {
      return address.port;
    }
    throw new Error("Server address is not available");
  }

  public async start(): Promise<void> {
    if (this.server.listening) {
      return;
    }

    return new Promise<void>((resolve) => {
      this.server.listen(0, () => {
        resolve();
      });
    });
  }

  public broadcast(message: string): void {
    this.sessions.forEach((ws) => {
      ws.send(message);
    });
  }

  public dispose(): void {
    this.server.close();
  }
}

export class NetworkPlugin implements ToolPlugin {
  public readonly id: ToolKey = NETWORK_PLUGIN_ID;
  public readonly label = "Network";
  public readonly persist = true;

  public pluginAvailable = true;
  public toolInstalled = false;

  private readonly websocketBackend: NetworkCDPWebsocketBackend;
  private devtoolsListeners: Disposable[] = [];

  constructor(private readonly inspectorBridge: RadonInspectorBridge) {
    this.websocketBackend = new NetworkCDPWebsocketBackend(this.sendCDPMessage);
    initialize();
  }

  public get websocketPort(): number {
    return this.websocketBackend.port;
  }

  private sendCDPMessage = (messageData: CDPMessage | IDEMessage): void => {
    this.inspectorBridge.sendPluginMessage("network", "cdp-message", messageData);
  };

  public activate(): void {
    this.websocketBackend.start().then(() => {
      this.setupEventListeners();
      this.enableNetworkMonitoring();
      commands.executeCommand("setContext", `RNIDE.Tool.Network.available`, true);
    });
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
    this.websocketBackend.dispose();
  }

  private setupEventListeners(): void {
    /**
     * All pluginMessages sent to the panel follow @type {NetworkPanelMessage} format:
     *
     * Message Flow:
     * - React Native app sends network events (requests, responses) via inspector bridge
     * - Bridge forwards messages to this plugin with pluginId: "network"
     * - Plugin transforms bridge messages into NetworkPanel protocol format
     * - Messages are broadcasted via WebSocket to all connected NetworkPanel clients
     */
    this.devtoolsListeners.push(
      this.inspectorBridge.onEvent("pluginMessage", (payload) => {
        if (payload.pluginId !== "network") {
          return;
        }

        // Transform bridge message format to NetworkPanel protocol format
        const messageType = payload.type === DEVTOOLS_CDP_MESSAGE_ID ? "CDP" : "IDE";
        const panelMessage = {
          type: messageType,
          payload: JSON.parse(payload.data),
        };

        // Broadcast to all connected NetworkPanel webviews via WebSocket
        this.websocketBackend.broadcast(JSON.stringify(panelMessage));
      })
    );

    // Enable network monitoring when app is ready
    this.devtoolsListeners.push(
      this.inspectorBridge.onEvent("appReady", () => {
        this.enableNetworkMonitoring();
      })
    );
  }

  private enableNetworkMonitoring(): void {
    this.sendCDPMessage({ method: "Network.enable", params: {} });
  }
}
