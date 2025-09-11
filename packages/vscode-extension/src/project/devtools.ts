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
import { BaseInspectorBridge, RadonInspectorBridgeEvents } from "./bridge";
import { disposeAll } from "../utilities/disposables";

function filePathForProfile() {
  const fileName = `profile-${Date.now()}.reactprofile`;
  const filePath = path.join(os.tmpdir(), fileName);
  return filePath;
}

type IdeMessageListener = <K extends keyof RadonInspectorBridgeEvents>(event: {
  type: K;
  data: RadonInspectorBridgeEvents[K];
}) => void;
type IdeMessage = Parameters<IdeMessageListener>[0];

/**
 * InspectorBridge implementation that uses the React DevTools frontend to receive messages from the application.
 */
export class DevtoolsInspectorBridge extends BaseInspectorBridge implements Disposable {
  private devtoolsConnection: DevtoolsConnection | undefined;
  private devtoolsServerListener: Disposable;
  private devtoolsConnectionListeners: Disposable[] = [];

  constructor(devtoolsServer: DevtoolsServer) {
    super();
    this.devtoolsConnection = devtoolsServer.connection;
    if (devtoolsServer.connection) {
      this.setupBridge(devtoolsServer.connection);
    }
    this.devtoolsServerListener = devtoolsServer.onConnection(this.setupBridge);
  }

  private setupBridge = (connection: DevtoolsConnection) => {
    this.devtoolsConnection = connection;
    disposeAll(this.devtoolsConnectionListeners);
    this.devtoolsConnectionListeners = [
      connection.onIdeMessage((message) => {
        this.emitEvent(message.type, message.data);
      }),
      connection.onDisconnected(() => {
        if (connection === this.devtoolsConnection) {
          this.devtoolsConnectionListeners = [];
          disposeAll(this.devtoolsConnectionListeners);
        }
      }),
    ];
  };

  dispose() {
    disposeAll(this.devtoolsConnectionListeners);
    this.devtoolsServerListener.dispose();
  }

  protected send(message: unknown): void {
    this.devtoolsConnection?.send("RNIDE_message", message);
  }
}

export class DevtoolsConnection implements Disposable {
  bridge: FrontendBridge;
  store: Store;
  connected: boolean = true;

  private readonly ideMessageEventEmitter: EventEmitter<IdeMessage> = new EventEmitter();
  private readonly disconnectedEventEmitter: EventEmitter<void> = new EventEmitter();

  public readonly onIdeMessage = this.ideMessageEventEmitter.event;
  public readonly onDisconnected = this.disconnectedEventEmitter.event;

  constructor(private readonly wall: Wall) {
    // create the DevTools frontend for the connection
    this.bridge = createBridge(wall);
    this.store = createStore(this.bridge);

    this.bridge.addListener("RNIDE_message", (payload: unknown) => {
      this.ideMessageEventEmitter.fire(payload as IdeMessage);
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

  public send(event: string, payload: unknown) {
    this.wall.send(event, payload);
  }

  public disconnect() {
    this.disconnectedEventEmitter.fire();
    this.dispose();
  }

  public dispose() {
    if (!this.connected) {
      return;
    }
    this.connected = false;
    this.bridge.shutdown();
    this.disconnectedEventEmitter.dispose();
    this.ideMessageEventEmitter.dispose();
  }
}

export abstract class DevtoolsServer implements Disposable {
  private readonly connectionEventEmitter: EventEmitter<DevtoolsConnection> = new EventEmitter();
  private _connection: DevtoolsConnection | undefined;

  protected setConnection(connection: DevtoolsConnection | undefined) {
    this._connection?.dispose();
    this._connection = connection;
    if (connection) {
      this.connectionEventEmitter.fire(connection);
    }
  }

  public get connection() {
    return this._connection;
  }

  public readonly onConnection = this.connectionEventEmitter.event;

  public dispose(): void {
    this.connectionEventEmitter.dispose();
  }
}

class WebSocketDevtoolsServer extends DevtoolsServer implements Disposable {
  private wss: WebSocketServer;

  public get port() {
    const address = this.server.address();
    assert(
      address !== null && typeof address !== "string",
      "The address is an instance of `AddressInfo`"
    );
    return address.port;
  }

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
        session.disconnect();
      });
      ws.on("error", () => {
        session.disconnect();
      });

      super.setConnection(session);
    });
  }

  public dispose() {
    super.dispose();
    this.wss.close();
    this.server.close();
  }
}

export async function createWebSocketDevtoolsServer(): Promise<DevtoolsServer & { port: number }> {
  const server = http.createServer(() => {});
  const { promise: listenPromise, resolve, reject } = Promise.withResolvers<void>();

  server.listen(0, () => {
    const address = server.address();
    assert(
      address !== null && typeof address !== "string",
      "The address is an instance of `AddressInfo`"
    );
    const serverPort = address.port;
    Logger.info(`Devtools started on port ${serverPort}`);
    resolve();
  });

  function onErrorCallback(error: Error) {
    Logger.error("Devtools server error:", error);
    reject(new Error(`Could not start the React Devtools server`));
  }
  server.on("error", onErrorCallback);

  await listenPromise;

  const devtoolsServer = new WebSocketDevtoolsServer(server);
  return devtoolsServer;
}
