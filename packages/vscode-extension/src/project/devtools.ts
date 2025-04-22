import http from "http";
import { Disposable } from "vscode";
import { WebSocketServer, WebSocket } from "ws";
import { Logger } from "../Logger";
import {
  createBridge,
  createStore,
  FrontendBridge,
  Store,
  Wall,
} from "../../third-party/react-devtools/headless";
import path from "path";
import os from "os";

// Define event names as a const array to avoid duplication
export const DEVTOOLS_EVENTS = [
  "RNIDE_appReady",
  "RNIDE_navigationChanged",
  "RNIDE_fastRefreshStarted",
  "RNIDE_fastRefreshComplete",
  "RNIDE_openPreviewResult",
  "RNIDE_inspectData",
  "RNIDE_devtoolPluginsChanged",
  "RNIDE_rendersReported",
  "RNIDE_pluginMessage",
] as const;

// Define the payload types for each event
export interface DevtoolsEvents {
  RNIDE_appReady: [];
  RNIDE_navigationChanged: [{ displayName: string; id: string }];
  RNIDE_fastRefreshStarted: [];
  RNIDE_fastRefreshComplete: [];
  RNIDE_openPreviewResult: [{ previewId: string; error?: string }];
  RNIDE_inspectData: [{ id: number }];
  RNIDE_devtoolPluginsChanged: [{ plugins: string[] }];
  RNIDE_rendersReported: [any];
  RNIDE_pluginMessage: [{ scope: string; type: string; data: any }];
}

export class Devtools implements Disposable {
  private _port = 0;
  private server: any;
  private socket?: WebSocket;
  private startPromise: Promise<void> | undefined;
  private listeners: Map<keyof DevtoolsEvents, Array<(...payload: any) => void>> = new Map();

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

  public async appReady() {
    const { resolve, promise } = Promise.withResolvers<void>();
    const listener = this.onEvent("RNIDE_appReady", () => {
      resolve();
      listener.dispose();
    });
    return promise;
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

    wss.on("connection", (ws) => {
      if (this.socket !== undefined) {
        Logger.error("Devtools client already connected");
        this.socket.close();
      }
      Logger.debug("Devtools client connected");
      this.socket = ws;

      const wall: Wall = {
        listen(fn) {
          function listener(message: string) {
            const parsedMessage = JSON.parse(message);
            return fn(parsedMessage);
          }
          ws.on("message", listener);
          return () => {
            ws.off("message", listener);
          };
        },
        send(event, payload) {
          ws.send(JSON.stringify({ event, payload }));
        },
      };

      const bridge = createBridge(wall);
      const store = createStore(bridge);

      ws.on("close", () => {
        this.socket = undefined;
        bridge.shutdown();
      });

      // Register bridge listeners for ALL custom event types
      for (const event of DEVTOOLS_EVENTS) {
        bridge.addListener(event, (payload) => {
          this.listeners.get(event)?.forEach((listener) => listener(payload));
        });
      }
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

  public onEvent<K extends keyof DevtoolsEvents>(
    eventName: K,
    listener: (...payload: DevtoolsEvents[K]) => void
  ): Disposable {
    const listeners = this.listeners.get(eventName);
    if (!listeners) {
      this.listeners.set(eventName, [listener]);
    } else {
      const index = listeners.indexOf(listener);
      if (index === -1) {
        listeners.push(listener as (...payload: any) => void);
      }
    }
    return {
      dispose: () => {
        const listeners = this.listeners.get(eventName);
        if (listeners) {
          const index = listeners.indexOf(listener as (...payload: any) => void);
          if (index !== -1) {
            listeners.splice(index, 1);
          }
        }
      },
    };
  }
}
