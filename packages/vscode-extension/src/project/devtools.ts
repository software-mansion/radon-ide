import http from "http";
import { Disposable } from "vscode";
import { WebSocketServer, WebSocket } from "ws";
import { Logger } from "../Logger";
import {
  createBridge as createFrontendBridge,
  createStore,
  initialize as createDevTools,
  FrontendBridge,
  Wall,
} from "react-devtools-inline/frontend";
import { c } from "tar";

export class Devtools implements Disposable {
  private _port = 0;
  private server: any;
  private socket?: WebSocket;
  private bridge?: FrontendBridge;
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

  public async appReady() {
    const { resolve, promise } = Promise.withResolvers<void>();
    const listener = this.addListener("RNIDE_appReady", () => {
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

      // When data is received from a client
      // ws.on("message", (message: string) => {
      //   try {
      //     const { event, payload } = JSON.parse(message);
      //     Logger.log("Devtools message", event, payload);
      //     this.listeners.forEach((listener) => listener(event, payload));
      //   } catch (e) {
      //     Logger.error("Error while handling devtools websocket message", e);
      //   }
      // });

      const wall: Wall = {
        listen(fn) {
          function listener(message: string) {
            const { event, payload } = JSON.parse(message);
            return fn({ event, payload });
          }
          ws.on("message", listener);
          return () => {
            ws.off("message", listener);
          };
        },
        send(event, payload) {
          console.log("SENDING BRIDGEY", event, payload);
          ws.send(JSON.stringify({ event, payload }));
        },
      };

      this.bridge = createFrontendBridge(undefined as unknown as Window, wall);
      ws.on("close", () => {
        this.socket = undefined;
        this.bridge = undefined;
      });
      this.bridge.addListener("profilingStatus", () => console.log("JKHSDJDHJSD PROFILING STATUS"));
      // bridge.addListener("RNIDE_appReady", () => console.log("JKHSDJDHJSD APP READY"));
      // const store = createStore(bridge);
      // setTimeout(() => {
      //   console.log("Profiler store?", store.profilerStore);
      //   store.profilerStore.addListener("profilingData", (profilerData) => {
      //     console.log("PROFILERDATA", profilerData);
      //   });
      //   store.profilerStore.startProfiling();
      //   setTimeout(() => {
      //     store.profilerStore.stopProfiling();
      //   }, 5000);
      // }, 5000);
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

  public addListener(eventName: string, listener: (payload: any) => void): Disposable {
    this.bridge?.addListener(eventName, listener);
    return {
      dispose: () => {
        this.bridge?.removeListener(eventName, listener);
      },
    };
  }

  // public addListener(listener: (event: string, payload: any) => void) {
  //   this.listeners.add(listener);
  // }

  // public removeListener(listener: (event: string, payload: any) => void) {
  //   this.listeners.delete(listener);
  // }
}
