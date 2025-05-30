import { readFileSync } from "fs";

import { LiteMCP } from "litemcp";
import { z } from "zod";

import { getOpenPort } from "../utilities/common";
import { Logger } from "../Logger";
import { IDE } from "../project/ide";
import { ToolResponse, ToolSchema } from "./models";
import { callTool, getToolSchema } from "./api";

function buildZodSchema(toolSchema: ToolSchema): z.ZodType<unknown, z.ZodTypeDef, unknown> {
  const props = Object.values(toolSchema.inputSchema.properties);
  const entries = props.map((v) => [v.title, z.string()]);
  const obj = z.object(Object.fromEntries(entries));
  return obj;
}

async function screenshotToolDefinition(): ToolResponse {
  const project = IDE.getInstanceIfExists()?.project;

  if (!project || !project.deviceSession) {
    return (
      "Could not capture a screenshot!\n" +
      "The development viewport device is likely turned off.\n" +
      "Please turn on the Radon IDE emulator before proceeding."
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
        model_config: {
          extra: "allow",
        },
      },
    ],
    isError: false,
  };
}

async function startMcpServer() {
  const server = new LiteMCP("RadonAiServer", "1.0.0");

  server.addTool({
    name: "view_screenshot",
    description: "Get a screenshot of the app development viewport.",
    execute: screenshotToolDefinition,
  });

  const toolSchema = await getToolSchema();

  for (const tool of toolSchema.tools) {
    const zodSchema = buildZodSchema(tool);
    server.addTool({
      name: tool.name,
      description: tool.description,
      parameters: zodSchema,
      execute: async (args): ToolResponse => {
        const toolResponse = await callTool(tool.name, args);
        return toolResponse;
      },
    });
  }

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
