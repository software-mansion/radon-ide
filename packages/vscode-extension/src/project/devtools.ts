import http from "http";
import path from "path";
import fs from "fs";
import os from "os";
import assert from "assert";
import { Disposable, EventEmitter, Uri } from "vscode";
import { WebSocketServer } from "ws";
import { InspectedElementPayload } from "react-devtools-inline";
import { Logger } from "../Logger";
import {
  createBridge,
  createStore,
  prepareProfilingDataExport,
  Store,
  Wall,
  FrontendBridge,
} from "../../third-party/react-devtools/headless";
import { InspectorBridge, RadonInspectorBridgeEvents } from "./inspectorBridge";
import { DebugSession } from "../debugging/DebugSession";
import { disposeAll } from "../utilities/disposables";
import { TimeoutError } from "../common/Errors";

const TIMEOUT_DELAY = 10_000;
const INSPECT_RESULT_EVENT = "inspectedElement";
const INSPECT_REQUEST_EVENT = "inspectElement";

function filePathForProfile() {
  const fileName = `profile-${Date.now()}.reactprofile`;
  const filePath = path.join(os.tmpdir(), fileName);
  return filePath;
}

type IdeMessageListener = <K extends keyof RadonInspectorBridgeEvents>(event: {
  id: number;
  type: K;
  data: RadonInspectorBridgeEvents[K];
}) => void;
type IdeMessage = Parameters<IdeMessageListener>[0];

/**
 * InspectorBridge implementation that uses the React DevTools frontend to receive messages from the application.
 */
export class DevtoolsInspectorBridge extends InspectorBridge implements Disposable {
  private devtoolsConnection: DevtoolsConnection | undefined;
  private devtoolsServerListener?: Disposable;
  private devtoolsConnectionListeners: Disposable[] = [];
  private lastMessageId: number = 0;

  constructor() {
    super();
  }

  public setDevtoolsConnection(connection: DevtoolsConnection | undefined) {
    this.devtoolsConnection = connection;
    disposeAll(this.devtoolsConnectionListeners);

    if (!connection) {
      return;
    }

    this.devtoolsConnectionListeners = [
      connection.onIdeMessage((message) => {
        this.lastMessageId = message.id;
        this.send({ type: "ack", id: message.id });
        this.emitEvent(message.type, message.data);
      }),
      connection.onDisconnected(() => {
        if (connection === this.devtoolsConnection) {
          this.devtoolsConnectionListeners = [];
          disposeAll(this.devtoolsConnectionListeners);
        }
      }),
    ];
    const messageQueue = this.messageQueue;
    this.messageQueue = [];
    this.send({ type: "retransmit", id: this.lastMessageId });
    for (const message of messageQueue) {
      this.send(message);
    }
  }

  dispose() {
    disposeAll(this.devtoolsConnectionListeners);
    this.devtoolsServerListener?.dispose();
  }

  private messageQueue: unknown[] = [];
  protected send(message: unknown): void {
    if (this.devtoolsConnection === undefined) {
      this.messageQueue.push(message);
      return;
    }
    this.devtoolsConnection?.send("RNIDE_message", message);
  }
}

export class DevtoolsConnection implements Disposable {
  private bridge: FrontendBridge;
  private _store: Store;

  public connected: boolean = true;

  private readonly ideMessageEventEmitter: EventEmitter<IdeMessage> = new EventEmitter();
  private readonly disconnectedEventEmitter: EventEmitter<void> = new EventEmitter();
  private readonly profilingEventEmitter: EventEmitter<boolean> = new EventEmitter();

  public readonly onIdeMessage = this.ideMessageEventEmitter.event;
  public readonly onDisconnected = this.disconnectedEventEmitter.event;
  public readonly onProfilingChange = this.profilingEventEmitter.event;

  private bridgeRequestCounter = 0;

  constructor(private readonly wall: Wall) {
    // create the DevTools frontend for the connection
    this.bridge = createBridge(wall);
    this._store = createStore(this.bridge);

    this.bridge.addListener("RNIDE_message", (payload: unknown) => {
      this.ideMessageEventEmitter.fire(payload as IdeMessage);
    });

    // Register for isProfiling event on the profiler store
    this._store.profilerStore.addListener("isProfiling", () => {
      // @ts-ignore - isProfilingBasedOnUserInput exists but types are outdated
      const isProfiling = this._store.profilerStore.isProfilingBasedOnUserInput;
      this.profilingEventEmitter.fire(isProfiling);
    });
  }

  public get store() {
    return this._store;
  }

  private resolveInspectElementResult(requestID: number): Promise<InspectedElementPayload> {
    const { promise, resolve, reject } = Promise.withResolvers<InspectedElementPayload>();

    const cleanup = () => {
      this.bridge.removeListener(INSPECT_RESULT_EVENT, onInspectedElement);
      clearTimeout(timeoutID);
    };

    const onInspectedElement = (...args: unknown[]) => {
      const data = args[0] as InspectedElementPayload;
      if (data.responseID === requestID) {
        cleanup();
        resolve(data);
      }
    };

    this.bridge.addListener(INSPECT_RESULT_EVENT, onInspectedElement);

    const timeoutID = setTimeout(() => {
      cleanup();
      reject(new TimeoutError(`Timed out while inspecting element.`));
    }, TIMEOUT_DELAY);

    return promise;
  }

  public async inspectElementById(id: number) {
    const requestID = this.bridgeRequestCounter++;
    const rendererID = this._store.getRendererIDForElement(id) as number;

    const promise = this.resolveInspectElementResult(requestID);

    this.bridge.send(INSPECT_REQUEST_EVENT, {
      id,
      rendererID,
      requestID,
      path: null,
      forceFullData: true,
    });

    return promise;
  }

  public async startProfilingReact() {
    this._store?.profilerStore.startProfiling();
  }

  public async stopProfilingReact() {
    const { resolve, reject, promise } = Promise.withResolvers<Uri>();
    const saveProfileListener = async () => {
      const isProcessingData = this._store?.profilerStore.isProcessingData;
      if (!isProcessingData) {
        this._store?.profilerStore.removeListener("isProcessingData", saveProfileListener);
        const profilingData = this._store?.profilerStore.profilingData;
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

    this._store?.profilerStore.addListener("isProcessingData", saveProfileListener);
    this._store?.profilerStore.stopProfiling();
    this.bridge.addListener("shutdown", () => {
      this.disconnect();
    });
    return promise;
  }

  public send(event: string, payload: unknown) {
    this.wall.send(event, payload);
  }

  public disconnect() {
    if (this.connected) {
      this.disconnectedEventEmitter.fire();
    }
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
    this.profilingEventEmitter.dispose();
  }
}

export abstract class DevtoolsServer implements Disposable {
  private readonly connectionEventEmitter: EventEmitter<DevtoolsConnection> = new EventEmitter();
  private _connection: DevtoolsConnection | undefined;

  protected setConnection(connection: DevtoolsConnection | undefined) {
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

const BINDING_NAME = "__CHROME_DEVTOOLS_FRONTEND_BINDING__";
const DISPATCHER_GLOBAL = "__FUSEBOX_REACT_DEVTOOLS_DISPATCHER__";
const DEVTOOLS_DOMAIN_NAME = "react-devtools";

export class CDPDevtoolsServer extends DevtoolsServer implements Disposable {
  private disposables: Disposable[] = [];
  private initializeConnectionPromise: Promise<void> | undefined;

  constructor(private readonly debugSession: DebugSession) {
    super();
    this.disposables.push(
      debugSession.onJSDebugSessionStarted(() => {
        this.maybeInitializeConnection()
          .then(() => {
            Logger.debug(
              "[Devtools] Devtools connection initialized after JS Debug session started"
            );
          })
          .catch(() => {
            // we expect the method might fail to initialize the connection
          });
      }),
      debugSession.onScriptParsed(({ isMainBundle }) => {
        if (isMainBundle) {
          this.maybeInitializeConnection()
            .then(() => {
              Logger.debug("[Devtools] Devtools connection initialized after main bundle loaded");
            })
            .catch(() => {
              // we expect the method might fail to initialize the connection
            });
        }
      })
    );
  }

  private maybeInitializeConnection() {
    if (this.connection) {
      // NOTE: a single `DebugSession` only supports a single devtools connection at a time
      return Promise.reject(new Error("[Devtools] Connection already established."));
    }
    const initializeInternal = () => {
      const initializePromise = this.initializeConnection();
      initializePromise
        .then(() => {
          this.initializeConnectionPromise = undefined;
        })
        .catch(() => {
          // we expect the method might fail to initialize the connection
          // as the app might not be ready to connect yet
          Logger.debug("[Devtools] Failed to initialize devtools connection");
        });

      return initializePromise;
    };

    if (this.initializeConnectionPromise) {
      // devtools connections cannot be initialized concurrently, we only can establish
      // one connection, so if we are already in a process of initializing one, we only schedule
      // a new attempt if the previous one fails
      this.initializeConnectionPromise = this.initializeConnectionPromise.catch(() => {
        return initializeInternal();
      });
    } else {
      this.initializeConnectionPromise = initializeInternal();
    }

    return this.initializeConnectionPromise;
  }

  private async initializeConnection() {
    const debugSession = this.debugSession;

    // NOTE: the binding survives JS reloads, and the Devtools frontend will reconnect automatically
    await debugSession.addBinding(BINDING_NAME);
    const { result } = await debugSession.evaluateExpression({
      expression: `${DISPATCHER_GLOBAL}.initializeDomain("${DEVTOOLS_DOMAIN_NAME}")`,
    });
    if (result.className === "Error") {
      // NOTE: if the dispatcher is not present, it's likely the app
      // has not loaded yet or failed to load the JS bundle.
      // In either case, there's nothing to connect to.
      throw new Error("Failed to initialize devtools connection, dispatcher not present");
    }

    const wall: Wall = {
      listen(fn) {
        function listener(payload: string) {
          const parsedPayload = JSON.parse(payload);
          return fn(parsedPayload.message);
        }
        const subscription = debugSession.onBindingCalled((ev) => {
          if (ev.name === BINDING_NAME) {
            listener(ev.payload);
          }
        });
        return () => subscription.dispose();
      },
      send(event, payload, _transferable) {
        const serializedMessage = JSON.stringify({ event, payload });
        debugSession
          .evaluateExpression({
            expression: `void ${DISPATCHER_GLOBAL}.sendMessage("${DEVTOOLS_DOMAIN_NAME}", '${serializedMessage}')`,
          })
          .catch(() => {
            // this method might be used by the devtools bridge implementation while JS Debugger
            // is disconnected so we just ignore any errors here
          });
      },
    };

    const connection = new DevtoolsConnection(wall);
    const shutdownListener = this.debugSession.onDebugSessionTerminated(() => {
      connection.disconnect();
      shutdownListener.dispose();
    });
    connection.onDisconnected(() => {
      if (this.connection === connection) {
        this.setConnection(undefined);
      }
    });

    this.setConnection(connection);
  }

  public dispose() {
    super.dispose();
    this.connection?.disconnect();
    disposeAll(this.disposables);
  }
}

export class WebSocketDevtoolsServer extends DevtoolsServer implements Disposable {
  private wss: WebSocketServer;

  public get port() {
    const address = this.server.address();
    assert(
      address !== null && typeof address !== "string",
      "The address is an instance of `AddressInfo`"
    );
    return address.port;
  }

  public static async createServer(): Promise<WebSocketDevtoolsServer> {
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

  private constructor(private server: http.Server) {
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

      const connection = new DevtoolsConnection(wall);
      ws.on("close", () => {
        connection.disconnect();
      });
      ws.on("error", () => {
        connection.disconnect();
      });

      super.setConnection(connection);
    });
  }

  public dispose() {
    super.dispose();
    this.wss.close();
    this.server.close();
  }
}
