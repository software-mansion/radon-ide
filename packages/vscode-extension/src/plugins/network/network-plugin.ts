import http, { Server } from "http";
import { Disposable, window } from "vscode";
import { WebSocketServer, WebSocket } from "ws";
import { RadonInspectorBridge } from "../../project/bridge";
import { ToolKey, ToolPlugin } from "../../project/tools";
import { extensionContext } from "../../utilities/extensionContext";
import { Logger } from "../../Logger";
import { NetworkDevtoolsWebviewProvider } from "./NetworkDevtoolsWebviewProvider";

import LegacyArchitecture from "./LegacyArchitectureStrategy";
import NewArchitecture from "./NewArchitectureStrategy";

export const NETWORK_PLUGIN_ID = "network";
export interface ArchitectureStrategy {
  activate(): void;
  deactivate(): void;
  openTool(): void;
  dispose(): void;
  websocketMessageHandler(message: unknown): void;
  readonly pluginAvailable: boolean;
}

const NEW_ARCHITECTURE = false;

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

  constructor(private readonly websocketMessageHandler: (message: unknown) => void) {
    this.server = http.createServer(() => {});
    const wss = new WebSocketServer({ server: this.server });

    wss.on("connection", (ws) => {
      this.sessions.add(ws);

      ws.on("message", (message) => {
        try {
          const payload = JSON.parse(message.toString());
          if (payload.method.startsWith("Network.")) {
            // forward message to devtools
            this.websocketMessageHandler(payload);
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
  public toolInstalled = false;
  public readonly persist = true;

  public readonly websocketBackend;
  private readonly strategy: ArchitectureStrategy;

  constructor(readonly inspectorBridge: RadonInspectorBridge) {
    this.strategy = NEW_ARCHITECTURE ? new NewArchitecture(this) : new LegacyArchitecture(this);
    this.websocketBackend = new NetworkCDPWebsocketBackend((msg) =>
      this.strategy.websocketMessageHandler(msg)
    );
    initialize();
  }

  public onToolEvent(body: unknown): void {
    console.log("Request", body);
  }

  public get websocketPort() {
    return this.websocketBackend.port;
  }

  public get pluginAvailable(): boolean {
    return this.strategy.pluginAvailable;
  }

  activate(): void {
    this.strategy.activate();
  }

  deactivate(): void {
    this.strategy.deactivate();
  }

  openTool(): void {
    this.strategy.openTool();
  }

  dispose() {
    this.strategy.dispose();
  }
}
