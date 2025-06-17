import { randomUUID } from "node:crypto";
import { default as express, Express } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import z from "zod";
import { registerMcpTools } from "./toolRegistration";
import { Logger } from "../../Logger";

// Persistant store for MCP sessions.
const transports: { [sessionId: string]: StreamableHTTPServerTransport } = {};

function getHttpServer(): Express {
  const app = express();
  app.use(express.json());

  app.post("/mcp", async (req, res) => {
    // Check for existing session ID
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    let transport: StreamableHTTPServerTransport;

    if (sessionId && transports[sessionId]) {
      // Recycle transport
      transport = transports[sessionId];
    } else if (!sessionId) {
      // New transport
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (sid) => {
          // Store the transport by session ID
          transports[sid] = transport;
        },
      });

      // Clean up transport when closed
      transport.onclose = () => {
        if (transport.sessionId) {
          delete transports[transport.sessionId];
        }
      };
      const server = new McpServer({
        name: "example-server",
        version: "1.0.0",
      });

      server.registerTool(
        "add",
        {
          description: "Add two numbers",
          inputSchema: { a: z.number(), b: z.number() },
        },
        async ({ a, b }) => ({
          content: [{ type: "text", text: String(a + b) }],
        })
      );

      await registerMcpTools(server);

      // Connect to the MCP server
      await server.connect(transport);
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

    // Handle the request
    await transport.handleRequest(req, res, req.body);
  });

  const handleSessionRequest = async (req: express.Request, res: express.Response) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (!sessionId || !transports[sessionId]) {
      res.status(400).send("Invalid or missing session ID");
      return;
    }

    const transport = transports[sessionId];
    await transport.handleRequest(req, res);
  };

  app.get("/mcp", handleSessionRequest);
  app.delete("/mcp", handleSessionRequest);
  return app;
}

export async function startLocalMcpServer(port: number) {
  const server = getHttpServer();

  Logger.info(`Starting local MCP server on port: ${port}`);

  await new Promise<void>((resolve, reject) => {
    try {
      server.once("error", reject);
      server.listen(port, () => {
        server.off("error", reject);
        resolve();
      });
    } catch {
      reject();
    }
  });

  return port;
}
