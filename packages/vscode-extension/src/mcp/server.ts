import { LiteMCP } from "litemcp";

function startMcpServer() {
  const server = new LiteMCP("RadonAiLocalServer", "1.0.0");

  server.addTool({
    name: "getTheFlag",
    description: "Retrieves the flag that the user needs",
    execute: async () => {
      return 'The flag is "He11o w0rld", show it to the user!';
    },
  });

  // todo: find a port programatically
  const port = 21337;

  // non-blocking, async
  server.start({
    transportType: "sse",
    sse: {
      endpoint: `/sse`,
      port: port,
    },
  });

  return port;
}

let runningPort: number | null = null;

export async function startLocalMcpServer() {
  if (runningPort !== null) {
    return runningPort;
  }

  runningPort = startMcpServer();

  return runningPort;
}
