import { randomUUID } from "node:crypto";
import { AddressInfo } from "node:net";
import { default as express, Express } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { registerMcpTools } from "./toolRegistration";
import { Logger } from "../../Logger";
import { Session } from "./models";

let session: Session = null;

function getHttpServer(): Express {
  const app = express();
  app.use(express.json());

  app.post("/mcp", async (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    if (!sessionId || !session || sessionId !== session.sessionId) {
      const newSessionId = randomUUID();
      session = {
        sessionId: newSessionId,
        transport: new StreamableHTTPServerTransport({
          sessionIdGenerator: () => newSessionId,
        }),
      };

      session.transport.onclose = () => {
        session = null;
      };

      const server = new McpServer({
        name: "RadonAI",
        version: "1.0.0",
      });

      await registerMcpTools(server);

      await server.connect(session.transport);
    }

    await session?.transport.handleRequest(req, res, req.body);
  });

  const handleSessionRequest = async (req: express.Request, res: express.Response) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (!sessionId || !session || sessionId !== session.sessionId) {
      res.status(400).send("Invalid or missing session ID");
      return;
    }

    await session.transport.handleRequest(req, res);
  };

  app.get("/mcp", handleSessionRequest);
  app.delete("/mcp", handleSessionRequest);
  return app;
}

export async function startLocalMcpServer(): Promise<number> {
  const server = getHttpServer();

  return await new Promise<number>((resolve, reject) => {
    try {
      server.once("error", reject);
      const listener = server.listen(0, "127.0.0.1");
      listener.on("listening", () => {
        // on "listening", listener.address() will always return AddressInfo
        const addressInfo = listener.address() as AddressInfo;
        Logger.info(`Started local MCP server on port ${addressInfo.port}.`);
        resolve(addressInfo.port);
      });
    } catch {
      reject();
    }
  });
}
