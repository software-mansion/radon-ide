import { commands, Disposable } from "vscode";
import { Devtools } from "../../project/devtools";
import { ToolKey, ToolPlugin } from "../../project/tools";
import { WebSocketServer, WebSocket } from "ws";
import http, { Server } from "http";
import { resolve } from "path";

export type NetworkPluginToolName = "network";

class NetworkCDPWebsocketBackend implements Disposable {
  private server: Server;
  private sessions: Set<WebSocket> = new Set();

  constructor() {
    this.server = http.createServer(() => {});
    const wss = new WebSocketServer({ server: this.server });

    wss.on("connection", (ws) => {
      this.sessions.add(ws);

      ws.on("message", (message) => {
        try {
          const payload = JSON.parse(message);
          const response = { id: message.id, result: {} };
          ws.send(JSON.stringify(response));
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
  public readonly id: ToolKey = "network";
  public readonly label = "Network";
  public readonly available = true;

  private readonly websocketBackend = new NetworkCDPWebsocketBackend();
  private active = false;

  constructor(private readonly devtools: Devtools) {}

  public get websocketPort() {
    return this.websocketBackend.port;
  }

  activate(): void {
    this.active = true;
    this.devtools.appReady().then(async () => {
      if (!this.active) {
        return;
      }
      await this.websocketBackend.start();
      commands.executeCommand("setContext", `RNIDE.Tool.Network.available`, true);
      this.devtools.addListener(this.devtoolsListener);
      this.devtools.send("RNIDE_enableNetworkInspect", { enable: true });
    });
  }

  devtoolsListener = (event: string, payload: any) => {
    if (event === "RNIDE_networkInspectorCDPMessage") {
      this.websocketBackend.broadcast(payload);
    } else if (event === "RNIDE_appReady") {
      this.devtools.send("RNIDE_enableNetworkInspect", { enable: true });
    }
  };

  deactivate(): void {
    this.active = false;
    this.devtools.removeListener(this.devtoolsListener);
    this.devtools.send("RNIDE_enableNetworkInspect", { enable: false });
    commands.executeCommand("setContext", `RNIDE.Tool.Network.available`, false);
  }

  openTool(): void {
    commands.executeCommand(`RNIDE.Tool.Network.view.focus`);
  }

  dispose() {}
}
