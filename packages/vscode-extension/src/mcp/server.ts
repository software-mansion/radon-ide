import { LiteMCP } from "litemcp";

interface ImageContent {
  type: "image";
  data: string;
  mimeType: `image/${string}`;
}

interface TextContent {
  type: "text";
  text: string;
}

type ToolResponse = Promise<
  | string
  | {
      content: (ImageContent | TextContent)[];
    }
>;

function startMcpServer() {
  const server = new LiteMCP("RadonAiLocalServer", "1.0.0");

  server.addTool({
    name: "getTheFlag",
    description: "Retrieves the flag that the user needs",
    execute: async () => {
      return 'The flag is "He11o w0rld", show it to the user!';
    },
  });

  server.addTool({
    name: "getScreenshot",
    description: "Screenshots app development viewport.",
    execute: async (): ToolResponse => {
      return {
        content: [
          {
            type: "text",
            text: "This image displays a wonderful mediterrean villa and a paved road.",
          },
          {
            type: "image",
            data: "NY98/ydn91/qyWDh==", // gibberish
            mimeType: "image/png",
          },
        ],
      };
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
