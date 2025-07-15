import { randomUUID } from "node:crypto";
import { AddressInfo } from "node:net";
import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { Logger } from "../../Logger";
import { registerMcpTools } from "./toolRegistration";
import { Session } from "./models";
import { extensionContext } from "../../utilities/extensionContext";

export class LocalMcpServer {
  private static instance: LocalMcpServer;

  private session: Session | null = null;

  private expressServer: express.Express | null = null;
  private serverPort: Promise<number> | null = null;
  private setServerPort: ((port: number) => void) | null = null;

  private mcpServer: McpServer | null = null;
  private versionSuffix: number = 0;

  constructor() {
    if (LocalMcpServer.instance) {
      return LocalMcpServer.instance;
    }

    LocalMcpServer.instance = this;

    // Deferred promise. This syntax is akward, but there isn't another way of implementing it.
    // The this.setServerPort is set immediately & synchronously.
    this.serverPort = new Promise((resolve) => {
      this.setServerPort = resolve;
    });

    this.initializeHttpServer();
  }

  public async getPort() {
    // `this.serverPort` is set in the initializer.
    // Typescript incorrectly types it as nullable.
    return (await this.serverPort) ?? 0;
  }

  public reloadToolSchema() {
    this.session?.transport.close();
    this.session = null;
  }

  public setVersionSuffix(newSuffix: number) {
    this.versionSuffix = newSuffix;
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

      if (!sessionId || !this.session || sessionId !== this.session.sessionId) {
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
        this.mcpServer?.close();

        this.mcpServer = new McpServer({
          name: "RadonAI",
          version: this.getVersion(),
        });

        await registerMcpTools(this.mcpServer);

        await this.mcpServer.connect(this.session.transport);
      }

      await this.session?.transport.handleRequest(req, res, req.body);
    });

    app.get("/mcp", this.handleSessionRequest);
    app.delete("/mcp", this.handleSessionRequest);

    this.expressServer = app;

    const listener = this.expressServer?.listen(0, "127.0.0.1");

    listener?.on("listening", () => {
      // On "listening", listener.address() will always return AddressInfo
      const addressInfo = listener.address() as AddressInfo;
      this.setServerPort?.(addressInfo.port);
      Logger.info(`Started local MCP server on port ${addressInfo.port}.`);
    });
  }
}
