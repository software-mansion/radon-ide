import { randomUUID, createHash } from "node:crypto";
import { AddressInfo } from "node:net";
import http from "node:http";
import express from "express";
import { McpServer, RegisteredTool } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { Disposable, workspace } from "vscode";
import { Logger } from "../../Logger";
import { registerLocalMcpTools, registerRemoteMcpTool } from "./toolRegistration";
import { Session } from "./models";
import { extensionContext } from "../../utilities/extensionContext";
import { watchLicenseTokenChange } from "../../utilities/license";
import { getAppCachesDir } from "../../utilities/common";
import * as path from "path";
import * as fs from "fs/promises";
import { AuthenticationError, fetchRemoteToolSchema, ServerUnreachableError } from "../shared/api";
import { throttleAsync } from "../../utilities/throttle";

const NETWORK_RETRY_INTERVAL_MS = 15 * 1000; // 15 seconds

export class LocalMcpServer implements Disposable {
  private sessions: Map<string, Session> = new Map();

  private expressServer: http.Server;
  private mcpServer: McpServer;
  private serverPort: Promise<number>;
  private resolveServerPort: (port: number) => void;

  private remoteTools: Map<string, RegisteredTool> = new Map();
  private retryReloadToolsScheduled: boolean = false;

  private licenseTokenSubscription: Disposable;

  constructor() {
    this.mcpServer = new McpServer({
      name: "RadonAI",
      version: extensionContext.extension.packageJSON.version,
    });
    registerLocalMcpTools(this.mcpServer);

    const { promise, resolve } = Promise.withResolvers<number>();
    this.serverPort = promise;
    this.resolveServerPort = resolve;

    this.licenseTokenSubscription = watchLicenseTokenChange(() => {
      this.reloadRemoteTools();
    });

    this.expressServer = this.initializeHttpServer();
  }

  public dispose() {
    this.licenseTokenSubscription.dispose();
    this.mcpServer.close();
    this.expressServer.closeAllConnections();
    this.expressServer.close();
  }

  public async getPort() {
    return this.serverPort;
  }

  private async handleSessionRequest(req: express.Request, res: express.Response) {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (!sessionId) {
      res.status(400).send("Missing session ID");
      return;
    }

    const session = this.sessions.get(sessionId);
    if (!session) {
      res.status(400).send("Invalid session ID");
      return;
    }

    await session.transport.handleRequest(req, res);
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
      mcpServerUrl: `http://127.0.0.1:${port}/mcp`,
    };

    // Write the JSON file
    try {
      await fs.writeFile(mcpServerRecordLocation, JSON.stringify(mcpServerRecord, null, 2));
      Logger.info(`Updated MCP server record at ${mcpServerRecordLocation}`);
    } catch (error) {
      Logger.error("Failed to write MCP server record:", error);
    }
  }

  private unloadAllRemoteTools() {
    for (const tool of this.remoteTools.values()) {
      tool.remove();
    }
    this.remoteTools.clear();
  }

  private retryReloadRemoteTools() {
    if (this.retryReloadToolsScheduled) {
      return;
    }
    this.retryReloadToolsScheduled = true;
    setTimeout(() => {
      this.retryReloadToolsScheduled = false;
      this.reloadRemoteTools();
    }, NETWORK_RETRY_INTERVAL_MS);
  }

  /**
   * Implements a logic for handling remote tool errors, whether they're coming
   * from the tool fetch request or from the tool invocation.
   */
  private handleRemoteToolsError(error: Error) {
    if (error instanceof ServerUnreachableError) {
      // delete all remote tools as they are not available and retry later
      this.unloadAllRemoteTools();
      this.retryReloadRemoteTools();
    } else if (error instanceof AuthenticationError) {
      // delete all toos and don't retry, we will wait for authentication event to reload the tools
      this.unloadAllRemoteTools();
    } else {
      // there was some other error (possibly on the server side)
      // we do nothing here as the tools may still be functioning
    }
  }

  private async reloadRemoteToolsInternal() {
    try {
      const toolsInfo = await fetchRemoteToolSchema();
      const fetchedTools = toolsInfo.tools;

      // remove all tools that were registered before but are no longer on the server
      const remoteToolsToRemove = new Set<string>(this.remoteTools.keys());
      const toolsToRegister = [];
      for (const tool of fetchedTools) {
        remoteToolsToRemove.delete(tool.name);
        if (!this.remoteTools.has(tool.name)) {
          toolsToRegister.push(tool);
        }
      }
      for (const toolName of remoteToolsToRemove) {
        const toolToRemove = this.remoteTools.get(toolName);
        if (toolToRemove) {
          toolToRemove.remove();
          this.remoteTools.delete(toolName);
        }
      }
      for (const tool of toolsToRegister) {
        this.remoteTools.set(
          tool.name,
          registerRemoteMcpTool(this.mcpServer, tool, this.handleRemoteToolsError.bind(this))
        );
      }
      this.mcpServer.sendToolListChanged();
    } catch (error) {
      Logger.error("[RADON-MCP] Failed to fetch remote tool schema:", error);
      this.handleRemoteToolsError(error as Error);
    }
  }

  private reloadRemoteTools = throttleAsync(async () => this.reloadRemoteToolsInternal(), 1000);

  private initializeHttpServer(): http.Server {
    const app = express();
    app.use(express.json());

    app.post("/mcp", async (req, res) => {
      const sessionId = req.headers["mcp-session-id"] as string | undefined;

      if (!sessionId && isInitializeRequest(req.body)) {
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (sessionId: string) => {
            // Register the session when it's properly initialized
            const newSession: Session = {
              sessionId,
              transport,
            };
            this.sessions.set(sessionId, newSession);
            transport.onclose = () => {
              this.sessions.delete(sessionId);
            };
          },
        });

        res.on("close", () => transport.close());

        await this.mcpServer.connect(transport);
      }

      // Handle request for existing session
      if (sessionId) {
        const session = this.sessions.get(sessionId);
        if (session) {
          await session.transport.handleRequest(req, res, req.body);
        } else {
          res.status(400).send("Invalid session ID");
        }
      } else {
        res.status(400).send("Missing session ID");
      }
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
