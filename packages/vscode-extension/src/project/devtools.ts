import http from "http";
import path from "path";
import fs from "fs";
import os from "os";
import { Disposable, Uri } from "vscode";
import { WebSocketServer, WebSocket } from "ws";
import { NavigationRoute } from "../common/Project";
import { Logger } from "../Logger";
import {
  createBridge,
  createStore,
  prepareProfilingDataExport,
  Store,
  Wall,
} from "../../third-party/react-devtools/headless";

// Define event names as a const array to avoid duplication
export const DEVTOOLS_EVENTS = [
  "RNIDE_appReady",
  "RNIDE_navigationChanged",
  "RNIDE_navigationRouteListUpdated",
  "RNIDE_fastRefreshStarted",
  "RNIDE_fastRefreshComplete",
  "RNIDE_openPreviewResult",
  "RNIDE_inspectData",
  "RNIDE_devtoolPluginsChanged",
  "RNIDE_rendersReported",
  "RNIDE_pluginMessage",
  "RNIDE_isProfilingReact",
] as const;

// Define the payload types for each event
export interface DevtoolsEvents {
  RNIDE_appReady: [];
  RNIDE_navigationChanged: [{ displayName: string; id: string }];
  RNIDE_navigationRouteListUpdated: [NavigationRoute[]];
  RNIDE_fastRefreshStarted: [];
  RNIDE_fastRefreshComplete: [];
  RNIDE_openPreviewResult: [{ previewId: string; error?: string }];
  RNIDE_inspectData: [{ id: number }];
  RNIDE_devtoolPluginsChanged: [{ plugins: string[] }];
  RNIDE_rendersReported: [any];
  RNIDE_pluginMessage: [{ scope: string; type: string; data: any }];
  RNIDE_isProfilingReact: [boolean];
}

function filePathForProfile() {
  const fileName = `profile-${Date.now()}.reactprofile`;
  const filePath = path.join(os.tmpdir(), fileName);
  return filePath;
}

export class Devtools implements Disposable {
  private _port = 0;
  private server: any;
  private socket?: WebSocket;
  private startPromise: Promise<void> | undefined;
  private listeners: Map<keyof DevtoolsEvents, Array<(...payload: any) => void>> = new Map();
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

      // Register bridge listeners for ALL custom event types
      for (const event of DEVTOOLS_EVENTS) {
        bridge.addListener(event, (payload) => {
          this.listeners.get(event)?.forEach((listener) => listener(payload));
        });
      }

      // Register for isProfiling event on the profiler store
      store.profilerStore.addListener("isProfiling", () => {
        this.listeners
          .get("RNIDE_isProfilingReact")
          // @ts-ignore - isProfilingBasedOnUserInput exists but types are outdated
          ?.forEach((listener) => listener(store.profilerStore.isProfilingBasedOnUserInput));
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
        const listenersToClean = this.listeners.get(eventName);
        if (listenersToClean) {
          const index = listenersToClean.indexOf(listener as (...payload: any) => void);
          if (index !== -1) {
            listenersToClean.splice(index, 1);
          }
        }
      },
    };
  }
}
