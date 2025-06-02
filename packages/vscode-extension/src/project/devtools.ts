import http from "http";
import path from "path";
import fs from "fs";
import os from "os";
import { Disposable, Uri } from "vscode";
import { WebSocketServer, WebSocket } from "ws";
import { Logger } from "../Logger";
import {
  createBridge,
  createStore,
  prepareProfilingDataExport,
  Store,
  Wall,
} from "../../third-party/react-devtools/headless";
import { BaseInspectorBridge } from "./bridge";

function filePathForProfile() {
  const fileName = `profile-${Date.now()}.reactprofile`;
  const filePath = path.join(os.tmpdir(), fileName);
  return filePath;
}

export class Devtools extends BaseInspectorBridge implements Disposable {
  private _port = 0;
  private server: any;
  private socket?: WebSocket;
  private startPromise: Promise<void> | undefined;
  private store: Store | undefined;

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
    const listener = this.onEvent("appReady", () => {
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
      this.store = store;

      ws.on("close", () => {
        if (this.socket === ws) {
          this.socket = undefined;
        }
        bridge.shutdown();
        if (this.store === store) {
          this.store = undefined;
        }
      });

      bridge.addListener("RNIDE_message", (payload: any) => {
        const { type, data } = payload;
        this.emitEvent(type, data);
      });

      // Register for isProfiling event on the profiler store
      store.profilerStore.addListener("isProfiling", () => {
        // @ts-ignore - isProfilingBasedOnUserInput exists but types are outdated
        this.emitEvent("isProfilingReact", store.profilerStore.isProfilingBasedOnUserInput);
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

  public async startProfilingReact() {
    this.store?.profilerStore.startProfiling();
  }

  public async stopProfilingReact() {
    const { resolve, reject, promise } = Promise.withResolvers<Uri>();
    const saveProfileListener = async () => {
      const isProcessingData = this.store?.profilerStore.isProcessingData;
      if (!isProcessingData) {
        this.store?.profilerStore.removeListener("isProcessingData", saveProfileListener);
        const profilingData = this.store?.profilerStore.profilingData;
        if (profilingData) {
          const exportData = prepareProfilingDataExport(profilingData);
          const filePath = filePathForProfile();
          await fs.promises.writeFile(filePath, JSON.stringify(exportData));
          resolve(Uri.file(filePath));
        } else {
          reject(new Error("No profiling data available"));
        }
      }
    };

    this.store?.profilerStore.addListener("isProcessingData", saveProfileListener);
    this.store?.profilerStore.stopProfiling();
    return promise;
  }

  public dispose() {
    this.server?.close();
  }

  protected send(message: any) {
    this.socket?.send(JSON.stringify({ event: "RNIDE_message", payload: message }));
  }
}
