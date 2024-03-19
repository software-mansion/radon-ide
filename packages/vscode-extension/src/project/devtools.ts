import { Disposable } from "vscode";
import http from "http";
import { WebSocketServer } from "ws";
import { Logger } from "../Logger";

export class Devtools implements Disposable {
  private _port = 0;
  private server: any;
  private socket: any;
  private listeners: Set<(event: string, payload: any) => void> = new Set();
  private startPromise: Promise<void> | undefined;

  public get port() {
    return this._port;
  }

  public get hasConnectedClient() {
    return this.socket !== undefined;
  }

  public async ready() {
    if (!this.startPromise) {
      throw new Error("Devtools not started");
    }
    await this.startPromise;
  }

  public async start() {
    if (this.startPromise) {
      throw new Error("Devtools already started");
    }
    this.startPromise = this.startInternal();
    return this.startPromise;
  }

  private async startInternal() {
    this.server = http.createServer(() => {});
    const wss = new WebSocketServer({ server: this.server });

    wss.on("connection", (ws: any) => {
      if (this.socket !== undefined) {
        Logger.error("Devtools client already connected");
        this.socket.close();
      }
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

      ws.on("close", () => {
        this.socket = undefined;
      });
    });

    return new Promise<void>((resolve) => {
      this.server.listen(0, () => {
        this._port = this.server.address().port;
        Logger.info(`Devtools started on port ${this._port}`);
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
