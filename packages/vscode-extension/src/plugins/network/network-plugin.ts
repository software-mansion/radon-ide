import http, { Server } from "http";
import { commands, Disposable, window } from "vscode";
import { WebSocketServer, WebSocket } from "ws";
import { RadonInspectorBridge } from "../../project/bridge";
import { ToolKey, ToolPlugin } from "../../project/tools";
import { extensionContext } from "../../utilities/extensionContext";

import { Logger } from "../../Logger";
import { NetworkDevtoolsWebviewProvider } from "./NetworkDevtoolsWebviewProvider";
import { disposeAll } from "../../utilities/disposables";
import { CDPNetworkCommand } from "../../webview/utilities/communicationTypes";

export const NETWORK_PLUGIN_ID = "network";

let initialized = false;
async function initialize() {
  if (initialized) {
    return;
  }
  Logger.debug("Initilizing Network tool");
  initialized = true;

  const networkDevtoolsWebviewProvider = new NetworkDevtoolsWebviewProvider(extensionContext);

  extensionContext.subscriptions.push(
    networkDevtoolsWebviewProvider,
    window.registerWebviewViewProvider(`RNIDE.Tool.Network.view`, networkDevtoolsWebviewProvider, {
      webviewOptions: { retainContextWhenHidden: true },
    })
  );
}

interface CDPMessage {
  method: string;
  params: unknown;
}

type BroadcastListener = (message: CDPMessage) => void;

class NetworkCDPWebsocketBackend implements Disposable {
  private server: Server;
  private sessions: Set<WebSocket> = new Set();

  constructor(private readonly sendCDPMessage: (messageData: CDPMessage) => void) {
    this.server = http.createServer(() => {});
    const wss = new WebSocketServer({ server: this.server });

    wss.on("connection", (ws) => {
      this.sessions.add(ws);

      ws.on("message", (message) => {
        try {
          const payload = JSON.parse(message.toString());
          if (payload.method.startsWith("Network.")) {
            // forward message to devtools
            this.sendCDPMessage(payload);
          } else if (payload.id) {
            // send empty response otherwise
            const response = { id: payload.id, result: {} };
            ws.send(JSON.stringify(response));
          }
        } catch (err) {
          console.error("Network CDP invalid message format:", err);
        }
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
    // TODO: Check if this can be safely removed
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
  private messageListeners: BroadcastListener[] = [];

  constructor(private readonly inspectorBridge: RadonInspectorBridge) {
    this.websocketBackend = new NetworkCDPWebsocketBackend(this.sendCDPMessage);
    initialize();
  }

  public get websocketPort() {
    return this.websocketBackend.port;
  }

  public sendCDPMessage(messageData: CDPMessage) {
    this.inspectorBridge.sendPluginMessage("network", "cdp-message", messageData);
  }

  onMessageBroadcast(cb: BroadcastListener): Disposable {
    // TODO: Check if this should only be exposed to Network or all
    this.messageListeners.push(cb);
    return new Disposable(() => {
      let index = this.messageListeners.indexOf(cb);
      if (index !== -1) {
        this.messageListeners.splice(index, 1);
      }
    });
  }

  activate(): void {
    this.websocketBackend.start().then(() => {
      commands.executeCommand("setContext", `RNIDE.Tool.Network.available`, true);
      this.devtoolsListeners.push(
        this.inspectorBridge.onEvent("pluginMessage", (payload) => {
          if (payload.pluginId === "network") {
            this.websocketBackend.broadcast(payload.data);
            this.messageListeners.forEach((cb) => cb(payload.data));
          }
        })
      );
      this.devtoolsListeners.push(
        this.inspectorBridge.onEvent("appReady", () => {
          this.sendCDPMessage({ method: CDPNetworkCommand.Enable, params: {} });
        })
      );
      this.sendCDPMessage({ method: CDPNetworkCommand.Enable, params: {} });
    });
  }

  deactivate(): void {
    disposeAll(this.devtoolsListeners);
    this.sendCDPMessage({ method: CDPNetworkCommand.Disable, params: {} });
    commands.executeCommand("setContext", `RNIDE.Tool.Network.available`, false);
  }

  openTool(): void {
    commands.executeCommand(`RNIDE.Tool.Network.view.focus`);
  }

  dispose() {
    disposeAll(this.devtoolsListeners);
  }
}
