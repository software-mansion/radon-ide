import { LiteMCP } from "litemcp";

import { Logger } from "../../Logger";
import { registerMcpTools } from "./toolRegistration";

export async function startLocalMcpServer(port: number) {
  const server = new LiteMCP("RadonAiServer", "1.0.0");

  await registerMcpTools(server);

  Logger.info(`Starting local MCP server on port: ${port}`);

  await server.start({
    transportType: "sse",
    sse: {
      endpoint: `/sse`,
      port: port,
    },
  });

  return port;
}
