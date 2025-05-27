import { readFileSync } from "fs";
import { LiteMCP } from "litemcp";
import { getOpenPort } from "../utilities/common";
import { Logger } from "../Logger";
import { IDE } from "../project/ide";
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

async function startMcpServer() {
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
      const project = IDE.getInstanceIfExists()?.project;

      if (!project || !project.deviceSession) {
        return (
          "Could not capture a screenshot!\n" +
          "The development viewport device is likely turned off," +
          "tell the user to turn on Radon IDE emulator before proceeding with a."
        );
      }

      const screenshot = await project.deviceSession.captureScreenshot();

      const contents = readFileSync(screenshot.tempFileLocation, { encoding: "base64" });

      return {
        content: [
          {
            type: "image",
            data: contents,
            mimeType: "image/png",
          },
        ],
      };
    },
  });

  const port = await getOpenPort();

  Logger.info(`Starting local MCP server on port: ${port}`);

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

  runningPort = await startMcpServer();

  return runningPort;
}
