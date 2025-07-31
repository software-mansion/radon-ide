import { randomUUID } from "node:crypto";
import { AddressInfo } from "node:net";
import http from "node:http";
import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { Disposable, EventEmitter } from "vscode";
import { Logger } from "../../Logger";
import { registerMcpTools } from "./toolRegistration";
import { Session } from "./models";
import { extensionContext } from "../../utilities/extensionContext";
import { ConnectionListener } from "../shared/ConnectionListener";
import { watchLicenseTokenChange } from "../../utilities/license";

export class LocalMcpServer implements Disposable {
  private session: Session | null = null;

  private expressServer: http.Server | null = null;
  private serverPort: Promise<number>;
  private setServerPort: ((port: number) => void) | null = null;

  private mcpServer: McpServer | null = null;
  private versionSuffix: number = 0;

  private connectionListener: ConnectionListener;
  private connectionSubscription: Disposable;
  private licenseTokenSubscription: Disposable;

  private serverReloadEmitter: EventEmitter<void>;

  constructor(connectionListener: ConnectionListener) {
    // Deferred promise. The this.setServerPort is set immediately & synchronously.
    this.serverPort = new Promise<number>((resolve) => {
      this.setServerPort = resolve;
    });

    this.connectionListener = connectionListener;

    this.serverReloadEmitter = new EventEmitter<void>();

    this.connectionSubscription = this.connectionListener.onConnectionRestored(() => {
      this.reloadToolSchema();
    });

    this.licenseTokenSubscription = watchLicenseTokenChange(() => {
      this.reloadToolSchema();
    });

    this.initializeHttpServer();
  }

  public async dispose(): Promise<void> {
    this.connectionSubscription.dispose();
    this.licenseTokenSubscription.dispose();
    this.serverReloadEmitter.dispose();
    this.mcpServer?.close();
    this.expressServer?.closeAllConnections();
    this.expressServer?.close();
    this.session = null;
  }

  public async getPort() {
    return this.serverPort;
  }

  private reloadToolSchema() {
    this.versionSuffix += 1;
    this.session?.transport.close();
    this.session = null;
    this.serverReloadEmitter.fire();
  }

  public onReload(cb: () => void): Disposable {
    return this.serverReloadEmitter.event(cb);
  }

  public getVersion(): string {
    const baseVersion = extensionContext.extension.packageJSON.version;
    return `${baseVersion}.${this.versionSuffix}`;
  }

  private async handleSessionRequest(req: express.Request, res: express.Response) {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (!sessionId || !this.session || sessionId !== this.session.sessionId) {
      res.status(400).send("Invalid or missing session ID");
      return;
    }

    await this.session.transport.handleRequest(req, res);
  }

  private initializeHttpServer() {
    const app = express();
    app.use(express.json());

    app.post("/mcp", async (req, res) => {
      const sessionId = req.headers["mcp-session-id"] as string | undefined;

      if (!sessionId && isInitializeRequest(req.body)) {
        const newSessionId = randomUUID();

        // Clean up old session
        this.session?.transport.close();

        this.session = {
          sessionId: newSessionId,
          transport: new StreamableHTTPServerTransport({
            sessionIdGenerator: () => newSessionId,
          }),
        };

        this.session.transport.onclose = () => {
          this.session = null;
        };

        // Clean up old mcp server
        await this.mcpServer?.close();

        this.mcpServer = new McpServer({
          name: "RadonAI",
          version: this.getVersion(),
        });

        await registerMcpTools(this.mcpServer, this.connectionListener);

        await this.mcpServer.connect(this.session.transport);
      }

      await this.session?.transport.handleRequest(req, res, req.body);
    });

    app.get("/mcp", this.handleSessionRequest.bind(this));
    app.delete("/mcp", this.handleSessionRequest.bind(this));

    this.expressServer = app.listen(0, "127.0.0.1");

    this.expressServer?.on("listening", () => {
      // On "listening", listener.address() will always return AddressInfo
      const addressInfo = this.expressServer?.address() as AddressInfo;
      this.setServerPort?.(addressInfo.port);
      Logger.info(`Started local MCP server on port ${addressInfo.port}.`);
    });
  }
}
