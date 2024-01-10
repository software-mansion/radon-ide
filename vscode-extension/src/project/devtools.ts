import { Disposable } from "vscode";
import { PreviewsPanel } from "../panels/PreviewsPanel";
import http from "http";
import { WebSocketServer } from "ws";
import { Logger } from "../Logger";

export class Devtools implements Disposable {
  private _port = 0;
  private server: any;
  private socket: any;
  private listeners: Set<(event: string, payload: any) => void> = new Set();

  public get port() {
    return this._port;
  }

  public async start() {
    this.server = http.createServer(() => {});
    const wss = new WebSocketServer({ server: this.server });

    wss.on("connection", (ws: any) => {
      Logger.debug("Devtools client connected");
      this.socket = ws;

      // When data is received from a client
      ws.on("message", (message: string) => {
        try {
          const { event, payload } = JSON.parse(message);
          Logger.log("Devtools message", event);
          this.listeners.forEach((listener) => listener(event, payload));
        } catch (e) {
          Logger.error("Error while handling devtools websocket message", e);
        }
      });
    });

    this.addListener((event, payload) => {
      if (event === "rnp_appReady") {
        Logger.debug("App ready");
        const { appKey } = payload;
        if (appKey !== "main") {
          // PreviewsPanel.currentPanel?.notifyAppUrlChanged(appKey);
        }
      } else if (event === "rnp_navigationChanged") {
        PreviewsPanel.currentPanel?.notifyNavigationChanged({
          displayName: payload.displayName,
          id: payload.id,
        });
      }
    });

    return new Promise<void>((resolve) => {
      this.server.listen(0, () => {
        this._port = this.server.address().port;
        resolve();
      });
    });
  }

  public dispose() {
    this.server.close();
  }

  public send(event: string, payload?: any) {
    this.socket?.send(JSON.stringify({ event, payload }));
  }

  public rpc(event: string, payload: any, responseEvent: string, callback: (payload: any) => void) {
    const listener = (event: string, payload: any) => {
      if (event === responseEvent) {
        callback(payload);
        this.removeListener(listener);
      }
    };

    this.addListener(listener);
    this.send(event, payload);
  }

  public addListener(listener: (event: string, payload: any) => void) {
    this.listeners.add(listener);
  }

  public removeListener(listener: (event: string, payload: any) => void) {
    this.listeners.delete(listener);
  }
}
