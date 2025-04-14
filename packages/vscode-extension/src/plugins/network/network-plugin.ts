import http, { Server } from "http";
import { commands, Disposable, window } from "vscode";
import { WebSocketServer, WebSocket } from "ws";
import { Devtools } from "../../project/devtools";
import { ToolKey, ToolPlugin } from "../../project/tools";
import { extensionContext } from "../../utilities/extensionContext";

import { Logger } from "../../Logger";
import { NetworkDevtoolsWebviewProvider } from "./NetworkDevtoolsWebviewProvider";
import { disposeAll } from "../../utilities/disposables";

export const NETWORK_PLUGIN_ID = "network";

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

  constructor(private readonly devtools: Devtools) {
    this.server = http.createServer(() => {});
    const wss = new WebSocketServer({ server: this.server });

    wss.on("connection", (ws) => {
      this.sessions.add(ws);

      ws.on("message", (message) => {
        try {
          const payload = JSON.parse(message.toString());
          if (payload.method.startsWith("Network.")) {
            // forward message to devtools
            this.devtools.send("RNIDE_networkInspectorCDPRequest", payload);
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

  public available = false;
  public readonly persist = true;

  private readonly websocketBackend;
  private devtoolsListeners: Disposable[] = [];

  constructor(private readonly devtools: Devtools) {
    this.websocketBackend = new NetworkCDPWebsocketBackend(devtools);
    initialize();
  }

  public get websocketPort() {
    return this.websocketBackend.port;
  }

  activate(): void {
    this.websocketBackend.start().then(() => {
      commands.executeCommand("setContext", `RNIDE.Tool.Network.available`, true);
      this.devtoolsListeners.push(
        this.devtools.addListener("RNIDE_networkInspectorCDPMessage", (payload) => {
          this.websocketBackend.broadcast(payload);
        })
      );
      this.devtoolsListeners.push(
        this.devtools.addListener("RNIDE_appReady", () => {
          this.devtools.send("RNIDE_enableNetworkInspect", { enable: true });
        })
      );
    });
  }

  deactivate(): void {
    disposeAll(this.devtoolsListeners);
    this.devtools.send("RNIDE_enableNetworkInspect", { enable: false });
    commands.executeCommand("setContext", `RNIDE.Tool.Network.available`, false);
  }

  openTool(): void {
    commands.executeCommand(`RNIDE.Tool.Network.view.focus`);
  }

  dispose() {
    disposeAll(this.devtoolsListeners);
  }
}
