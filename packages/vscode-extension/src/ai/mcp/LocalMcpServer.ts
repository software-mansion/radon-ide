import { randomUUID, createHash } from "node:crypto";
import { AddressInfo } from "node:net";
import http from "node:http";
import express from "express";
import * as path from "path";
import * as fs from "fs/promises";
import { McpServer, RegisteredTool } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { Disposable, EventEmitter, workspace } from "vscode";
import { Logger } from "../../Logger";
import { registerLocalMcpTools, registerRemoteMcpTool } from "./toolRegistration";
import { extensionContext } from "../../utilities/extensionContext";
import { watchLicenseTokenChange } from "../../utilities/license";
import { getAppCachesDir } from "../../utilities/common";
import { AuthenticationError, fetchRemoteToolSchema, ServerUnreachableError } from "../shared/api";
import { throttleAsync } from "../../utilities/throttle";
import { ENTRY_KEY } from "./configCreator";

const NETWORK_RETRY_INTERVAL_MS = 15 * 1000; // 15 seconds

export class LocalMcpServer implements Disposable {
  private transports: Map<string, StreamableHTTPServerTransport> = new Map();

  private expressServer: http.Server;
  private mcpServer: McpServer;
  private serverPort: Promise<number>;
  private resolveServerPort: (port: number) => void;

  private remoteTools: Map<string, RegisteredTool> = new Map();
  private retryReloadToolsTimeout: NodeJS.Timeout | null = null;

  private licenseTokenSubscription: Disposable;

  protected onToolListChangedEmitter = new EventEmitter<void>();

  constructor() {
    this.mcpServer = new McpServer({
      name: ENTRY_KEY,
      version: extensionContext.extension.packageJSON.version,
    });
    registerLocalMcpTools(this.mcpServer);

    const { promise, resolve } = Promise.withResolvers<number>();
    this.serverPort = promise;
    this.resolveServerPort = resolve;

    // the callback is called immediately and then with future changes of the token
    // therefore we don't need to trigger reloadRemoteTools here separately
    this.licenseTokenSubscription = watchLicenseTokenChange(() => {
      // cancel any pending retries and reload immediately
      this.cancelRetryReloadTools();
      this.reloadRemoteTools();
    });

    this.expressServer = this.initializeHttpServer();
  }

  public dispose() {
    this.cancelRetryReloadTools();
    this.licenseTokenSubscription.dispose();
    this.mcpServer.close();
    this.expressServer.closeAllConnections();
    this.expressServer.close();
  }

  public async getPort() {
    return this.serverPort;
  }

  public onToolListChanged(listener: () => void) {
    return this.onToolListChangedEmitter.event(listener);
  }

  private async handleSessionRequest(req: express.Request, res: express.Response) {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (!sessionId) {
      res.status(400).send("Session ID is missing");
      return;
    }
    const transport = this.transports.get(sessionId);
    if (!transport) {
      res.status(404).send("Invalid session ID");
      return;
    }
    await transport.handleRequest(req, res);
  }

  private async updateMcpServerRecord() {
    const port = await this.getPort();

    const workspaceFolder = workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      Logger.warn("No workspace folder found, cannot update MCP server record");
      return;
    }

    const workspacePath = path.normalize(workspaceFolder.uri.fsPath);
    const workspaceHash = createHash("md5").update(workspacePath).digest("hex");

    const mcpServerRecordLocation = path.join(
      getAppCachesDir(),
      "Mcp",
      `radon-mcp-${workspaceHash}.json`
    );

    const mcpServerRecord = {
      workspaceFolder: workspacePath,
      mcpServerUrl: `http://127.0.0.1:${port}/mcp`,
    };

    try {
      // Ensure the Mcp directory exists and write the JSON file
      const mcpDir = path.dirname(mcpServerRecordLocation);
      await fs.mkdir(mcpDir, { recursive: true });
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
    if (this.retryReloadToolsTimeout) {
      return;
    }
    this.retryReloadToolsTimeout = setTimeout(() => {
      this.retryReloadToolsTimeout = null;
      this.reloadRemoteTools();
    }, NETWORK_RETRY_INTERVAL_MS);
  }

  private cancelRetryReloadTools() {
    if (this.retryReloadToolsTimeout) {
      clearTimeout(this.retryReloadToolsTimeout);
      this.retryReloadToolsTimeout = null;
    }
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
      let toolsChanged = false;
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
          toolsChanged = true;
        }
      }
      for (const tool of toolsToRegister) {
        this.remoteTools.set(
          tool.name,
          registerRemoteMcpTool(this.mcpServer, tool, this.handleRemoteToolsError.bind(this))
        );
        toolsChanged = true;
      }
      if (toolsChanged) {
        this.mcpServer.sendToolListChanged();
        this.onToolListChangedEmitter.fire();
      }
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
      let transport: StreamableHTTPServerTransport;

      if (sessionId && this.transports.has(sessionId)) {
        // reuse existing transport
        transport = this.transports.get(sessionId)!;
      } else if (!sessionId && isInitializeRequest(req.body)) {
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (newSessionId: string) => {
            this.transports.set(newSessionId, transport);
          },
        });
        transport.onclose = () => {
          if (transport.sessionId) {
            this.transports.delete(transport.sessionId);
          }
        };

        await this.mcpServer.connect(transport);
      } else {
        // Invalid request
        res.status(400).json({
          jsonrpc: "2.0",
          error: {
            code: -32000,
            message: "Bad Request: No valid session ID provided",
          },
          id: null,
        });
        return;
      }

      await transport.handleRequest(req, res, req.body);
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
