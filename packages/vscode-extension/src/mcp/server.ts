import { readFileSync } from "fs";

import { LiteMCP } from "litemcp";
import { z } from "zod";

import { getOpenPort } from "../utilities/common";
import { Logger } from "../Logger";
import { IDE } from "../project/ide";

interface ImageContent {
  type: "image";
  data: string;
  mimeType: `image/${string}`;
  model_config: {
    extra: "allow";
  };
}

interface TextContent {
  type: "text";
  text: string;
}

type ToolResponse = Promise<
  | string
  | {
      content: (ImageContent | TextContent)[];
      isError: false;
    }
>;

interface ToolSchema {
  name: string;
  description: string;
  inputSchema: {
    title: string;
    description: string;
    type: "object";
    properties: Record<string, { title: string; type: string }>;
    required: string[];
  };
}

interface ToolsInfo {
  tools: ToolSchema[];
}

const DEBUG_BACKEND_URL = "http://localhost:8000/api/";
const BACKEND_URL = DEBUG_BACKEND_URL; // "https://radon-ai-backend.swmansion.com/api/";
const TOOL_INFO_URL = BACKEND_URL + "get_tool_schema/";

// const TOOL_CALL_URL = BACKEND_URL + "tool_calls/";
// async function _callTool(toolName: string, args: object) {
//   const url = TOOL_CALL_URL + toolName;
//   try {
//     return await fetch(url, { method: "POST", body: JSON.stringify(args) });
//   } catch {
//     return "Failed tool call.";
//   }
// }

function typeToZodType(schemaType: string): z.ZodType {
  switch (schemaType) {
    case "string":
      // with current tools, it's always "z.string()"
      return z.string();
    default:
      return z.unknown();
  }
}

function buildZodSchema(toolSchema: ToolSchema): z.ZodType<unknown, z.ZodTypeDef, unknown> {
  const props = Object.values(toolSchema.inputSchema.properties);
  const entries = props.map((v) => [v.title, typeToZodType(v.type)]);
  const obj = z.object(Object.fromEntries(entries));

  Logger.info("Zod testing a:", props);
  Logger.info("Zod testing b:", entries);
  Logger.info("Zod testing c:", obj);

  return obj;
}

async function getToolSchema(): Promise<ToolsInfo> {
  try {
    return (await fetch(TOOL_INFO_URL)).json();
  } catch {
    Logger.error("Failed fetching tool schema.");
    return {
      tools: [],
    };
  }
}

async function screenshotToolDefinition(): ToolResponse {
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
    name: "getScreenshot",
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
      execute: async (): ToolResponse => {
        return "Foo bar baz.";
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
