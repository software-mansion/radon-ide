import http from "http";
import path from "path";
import fs from "fs";
import os from "os";
import assert from "assert";
import { Disposable, EventEmitter, Uri } from "vscode";
import { WebSocketServer } from "ws";
import { Logger } from "../Logger";
import {
  createBridge,
  createStore,
  prepareProfilingDataExport,
  Store,
  Wall,
  FrontendBridge,
} from "../../third-party/react-devtools/headless";
import { BaseInspectorBridge } from "./bridge";

function filePathForProfile() {
  const fileName = `profile-${Date.now()}.reactprofile`;
  const filePath = path.join(os.tmpdir(), fileName);
  return filePath;
}

export class DevtoolsConnection extends BaseInspectorBridge implements Disposable {
  bridge: FrontendBridge;
  store: Store;
  appReady: Promise<void>;
  connected: boolean = true;

  constructor(private readonly wall: Wall) {
    super();

    // set up `appReady` promise
    const { promise: appReady, resolve: resolveAppReady } = Promise.withResolvers<void>();
    this.appReady = appReady;
    const appReadyListener = this.onEvent("appReady", () => {
      resolveAppReady();
      appReadyListener.dispose();
    });

    // create the DevTools frontend for the connection
    this.bridge = createBridge(wall);
    this.store = createStore(this.bridge);

    this.bridge.addListener("RNIDE_message", (payload: any) => {
      const { type, data } = payload;
      this.emitEvent(type, data);
    });

    // Register for isProfiling event on the profiler store
    this.store.profilerStore.addListener("isProfiling", () => {
      // @ts-ignore - isProfilingBasedOnUserInput exists but types are outdated
      this.emitEvent("isProfilingReact", this.store.profilerStore.isProfilingBasedOnUserInput);
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

  public send(message: unknown) {
    this.wall.send("RNIDE_message", message);
  }

  public close() {
    this.dispose();
    this.emitEvent("disconnected", []);
  }

  public dispose() {
    if (!this.connected) {
      return;
    }
    this.connected = false;
    this.bridge.shutdown();
  }
}

export abstract class DevtoolsServer implements Disposable {
  protected readonly connectionEventEmitter: EventEmitter<DevtoolsConnection> = new EventEmitter();

  public readonly onConnection = this.connectionEventEmitter.event;

  public dispose(): void {
    this.connectionEventEmitter.dispose();
  }
}

class WebSocketDevtoolsServer extends DevtoolsServer implements Disposable {
  private wss: WebSocketServer;

  constructor(private server: http.Server) {
    super();
    this.wss = new WebSocketServer({ server });

    this.wss.on("connection", (ws) => {
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

      const session = new DevtoolsConnection(wall);
      ws.on("close", () => {
        session.close();
      });

      this.connectionEventEmitter.fire(session);
    });
  }

  public dispose() {
    super.dispose();
    this.wss.close();
    this.server.close();
  }
}

export async function createWebSocketDevtoolsServer() {
  const server = http.createServer(() => {});
  const devtoolsServer = new WebSocketDevtoolsServer(server);
  const { promise, resolve } = Promise.withResolvers<number>();

  server.listen(0, () => {
    const address = server.address();
    assert(
      address !== null && typeof address !== "string",
      "The address is an instance of `AddressInfo`"
    );
    const serverPort = address.port;
    Logger.info(`Devtools started on port ${serverPort}`);
    resolve(serverPort);
  });

  const port = await promise;
  return { port, devtoolsServer };
}
