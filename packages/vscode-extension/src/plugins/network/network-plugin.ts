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

interface RequestOptions {
  method: string;
  headers: Record<string, string>;
  body?: string;
}

interface RequestData {
  method: string;
  headers: Record<string, string>;
  url: string;
  postData?: unknown;
}

interface CDPMessage {
  method?: string;
  id?: string | number;
  params?: {
    request?: RequestData;
  };
  result?: unknown;
}

interface WebSocketMessageData {
  toString(): string;
}

export const NETWORK_PLUGIN_ID = "network";

function determineLanguage(contentType: string, body: string): string {
  if (contentType.includes("application/json") || contentType.includes("text/json")) {
    return "json";
  } else if (contentType.includes("text/html") || contentType.includes("application/xhtml+xml")) {
    return "html";
  } else if (contentType.includes("text/xml") || contentType.includes("application/xml")) {
    return "xml";
  } else if (contentType.includes("text/css")) {
    return "css";
  } else if (
    contentType.includes("text/javascript") ||
    contentType.includes("application/javascript") ||
    contentType.includes("application/x-javascript")
  ) {
    return "javascript";
  } else if (contentType.includes("text/plain")) {
    return "text";
  }
  const guessLanguageFromText = () => {
    const trimmedBody = body.trim();
    if (trimmedBody.startsWith("<?xml") || trimmedBody.startsWith("<")) {
      if (trimmedBody.includes("<!DOCTYPE html") || trimmedBody.includes("<html")) {
        return "html";
      }
      return "xml";
    } else if (trimmedBody.startsWith("{") || trimmedBody.startsWith("[")) {
      return "json";
    }

    return "text";
  };

  // Fallback for "text/..."
  return guessLanguageFromText();
}

function formatDataBasedOnLanguage(body: string, language: string): string {
  if (language === "json") {
    try {
      const parsed = JSON.parse(body);
      return JSON.stringify(parsed, null, 2);
    } catch (e) {
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

  /**
   * Handles the "Network.fetchFullResponseBody" CDP message, by
   * fetching the response and displaying the body in vscode editor tab.
   *
   * On fetch error, shows a dismissable error notification.
   */
  private async handleFetchFullResponseBody(
    requestOptions: RequestData | undefined
  ): Promise<void> {
    if (!requestOptions) {
      return;
    }

    const fetchOptions: RequestOptions = {
      method: requestOptions.method,
      headers: requestOptions.headers,
    };

    if (requestOptions.postData) {
      fetchOptions.body = JSON.stringify(requestOptions.postData);
    }

    try {
      const response = await fetch(requestOptions.url, fetchOptions);
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }

      const contentType = response.headers.get("content-type") || "";
      const data = await response.text();

      const language = determineLanguage(contentType, data);
      const formattedData = formatDataBasedOnLanguage(data, language);

      openContentInEditor(formattedData, language);
    } catch (error) {
      console.error("There was a problem fetching the data:", error);
      showDismissableError("Data could not be fetched.");
    }
  }

  /**
   * Sends empty result if non-"Network." message was received
   */
  private handleGenericMessage(payload: CDPMessage, ws: WebSocket): void {
    if (payload.id) {
      const response = { id: payload.id, result: {} };
      ws.send(JSON.stringify(response));
    }
  }

  private async handleWebSocketMessage(
    message: WebSocketMessageData,
    ws: WebSocket
  ): Promise<void> {
    try {
      const payload: CDPMessage = JSON.parse(message.toString());

      if (payload.method === "Network.fetchFullResponseBody") {
        await this.handleFetchFullResponseBody(payload.params?.request);
      } else if (payload.method?.startsWith("Network.")) {
        // Forwards all "Network." messages to devtools inspector bridge,
        // which in turns sends them through the websocket to the app
        this.sendCDPMessage(payload);
      } else {
        this.handleGenericMessage(payload, ws);
      }
    } catch (err) {
      console.error("Network CDP invalid message format:", err);
    }
  }

  constructor(private readonly sendCDPMessage: (messageData: CDPMessage) => void) {
    this.server = http.createServer(() => {});
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

  public get port() {
    const address = this.server.address();
    Logger.debug("Server address:", address);

    if (address && typeof address === "object") {
      return address.port;
    }
    throw new Error("Server address is not available");
  }

  public async start() {
    // if server is already started, we return immediately
    if (this.server.listening) {
      return;
    }
    return new Promise<void>((resolve) => {
      this.server.listen(0, () => {
        resolve();
      });
    });
  }

  public broadcast(cdpMessage: string) {
    this.sessions.forEach((ws) => {
      ws.send(cdpMessage);
    });
  }

  public dispose() {
    this.server.close();
  }
}

export class NetworkPlugin implements ToolPlugin {
  public readonly id: ToolKey = NETWORK_PLUGIN_ID;
  public readonly label = "Network";

  public pluginAvailable = true;
  public toolInstalled = false;
  public readonly persist = true;

  private readonly websocketBackend;
  private devtoolsListeners: Disposable[] = [];

  constructor(private readonly inspectorBridge: RadonInspectorBridge) {
    this.websocketBackend = new NetworkCDPWebsocketBackend(this.sendCDPMessage);
    initialize();
  }

  public get websocketPort() {
    return this.websocketBackend.port;
  }

  sendCDPMessage = (messageData: CDPMessage) => {
    this.inspectorBridge.sendPluginMessage("network", "cdp-message", messageData);
  };

  activate(): void {
    this.websocketBackend.start().then(() => {
      commands.executeCommand("setContext", `RNIDE.Tool.Network.available`, true);
      this.devtoolsListeners.push(
        this.inspectorBridge.onEvent("pluginMessage", (payload) => {
          if (payload.pluginId === "network") {
            this.websocketBackend.broadcast(payload.data);
          }
        })
      );
      this.devtoolsListeners.push(
        this.inspectorBridge.onEvent("appReady", () => {
          this.sendCDPMessage({ method: "Network.enable", params: {} });
        })
      );
      this.sendCDPMessage({ method: "Network.enable", params: {} });
    });
  }

  deactivate(): void {
    disposeAll(this.devtoolsListeners);
    this.sendCDPMessage({ method: "Network.disable", params: {} });
    commands.executeCommand("setContext", `RNIDE.Tool.Network.available`, false);
  }

  openTool(): void {
    commands.executeCommand(`RNIDE.Tool.Network.view.focus`);
  }

  dispose() {
    disposeAll(this.devtoolsListeners);
  }
}
