import { randomUUID, createHash } from "node:crypto";
import { AddressInfo } from "node:net";
import http from "node:http";
import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { Disposable, workspace } from "vscode";
import { Logger } from "../../Logger";
import { registerMcpTools } from "./toolRegistration";
import { Session } from "./models";
import { extensionContext } from "../../utilities/extensionContext";
import { ConnectionListener } from "../shared/ConnectionListener";
import { watchLicenseTokenChange } from "../../utilities/license";
import { getAppCachesDir } from "../../utilities/common";
import * as path from "path";
import * as fs from "fs/promises";

export class LocalMcpServer implements Disposable {
  private session: Session | null = null;
  private versionSuffix: number = 0;

  private expressServer: http.Server;
  private mcpServer: McpServer | null = null;
  private serverPort: Promise<number>;
  private resolveServerPort: (port: number) => void;

  private connectionListener: ConnectionListener;
  private reconnectionSubscription: Disposable;
  private licenseTokenSubscription: Disposable;

  constructor(connectionListener: ConnectionListener) {
    const { promise, resolve } = Promise.withResolvers<number>();

    this.serverPort = promise;
    this.resolveServerPort = resolve;

    this.connectionListener = connectionListener;

    this.reconnectionSubscription = this.connectionListener.onConnectionRestored(() => {
      this.reloadToolSchema();
    });

    this.licenseTokenSubscription = watchLicenseTokenChange(() => {
      this.reloadToolSchema();
    });

    this.expressServer = this.initializeHttpServer();
  }

  public async dispose(): Promise<void> {
    this.reconnectionSubscription.dispose();
    this.licenseTokenSubscription.dispose();
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

  private async updateMcpServerRecord() {
    const port = await this.getPort();
    const appCachesDir = getAppCachesDir();

    // Get the workspace folder path
    const workspaceFolder = workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      Logger.warn("No workspace folder found, cannot update MCP server record");
      return;
    }

    const workspacePath = path.normalize(workspaceFolder.uri.fsPath);

    // Calculate MD5 hash of the workspace folder path
    const workspaceHash = createHash("md5").update(workspacePath).digest("hex");

    // Create the JSON config file path
    const mcpServerRecordLocation = path.join(
      appCachesDir,
      "Mcp",
      `radon-mcp-${workspaceHash}.json`
    );

    // Ensure the Mcp directory exists
    const mcpDir = path.dirname(mcpServerRecordLocation);
    await fs.mkdir(mcpDir, { recursive: true });

    // Create the JSON object with workspaceFolder and mcpServerUrl
    const mcpServerRecord = {
      workspaceFolder: workspacePath,
      mcpServerUrl: `http://localhost:${port}/mcp`,
    };

    // Write the JSON file
    try {
      await fs.writeFile(mcpServerRecordLocation, JSON.stringify(mcpServerRecord, null, 2));
      Logger.info(`Updated MCP server record at ${mcpServerRecordLocation}`);
    } catch (error) {
      Logger.error("Failed to write MCP server record:", error);
    }
  }

  private initializeHttpServer(): http.Server {
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

    return app.listen(0, "127.0.0.1").on("listening", async () => {
      // On "listening", listener.address() will always return AddressInfo
      const addressInfo = this.expressServer?.address() as AddressInfo;
      this.resolveServerPort(addressInfo.port);
      Logger.info(`Started local MCP server on port ${addressInfo.port}.`);
      await this.updateMcpServerRecord();
    });
  }
}
