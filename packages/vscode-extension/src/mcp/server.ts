import { readFileSync } from "fs";

import { LiteMCP } from "litemcp";
import { z } from "zod";

import { getOpenPort } from "../utilities/common";
import { Logger } from "../Logger";
import { IDE } from "../project/ide";
import { getLicenseToken } from "../utilities/license";

interface ImageContent {
  type: "image";
  data: string;
  mimeType: `image/${string}`;
  model_config?: {
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
      isError?: boolean;
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

interface ToolResult {
  tool_results: {
    content: string;
    tool_call_id: string;
  }[];
}

const BACKEND_URL = "http://localhost:8000/"; // "https://radon-ai-backend.swmansion.com/api/";

async function callTool(toolName: string, args: unknown): ToolResponse {
  // this function is similar to `chat:invokeToolCall()`, could merge them in the future
  try {
    const url = new URL("/api/tool_calls/", BACKEND_URL);
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${getLicenseToken()}`,
      },
      body: JSON.stringify({
        tool_calls: [
          {
            name: toolName,
            id: "3241", // temporarily necessary placeholder
            args,
          },
        ],
      }),
    });

    if (!response.ok) {
      // network error is not accurate, as the tool call might've been malformed by the agent
      return "Failed tool call.";
    }

    const results: ToolResult = await response.json();

    if (results.tool_results.length === 0) {
      return "Tool response empty.";
    }

    const toolResults: string = results.tool_results[0].content;

    return toolResults;
  } catch {
    return "Failed tool call.";
  }
}

function buildZodSchema(toolSchema: ToolSchema): z.ZodType<unknown, z.ZodTypeDef, unknown> {
  const props = Object.values(toolSchema.inputSchema.properties);
  const entries = props.map((v) => [v.title, z.string()]);
  const obj = z.object(Object.fromEntries(entries));
  return obj;
}

async function getToolSchema(): Promise<ToolsInfo> {
  try {
    const url = new URL("/api/get_tool_schema/", BACKEND_URL);
    const resp = await fetch(url);

    if (!resp.ok) {
      Logger.error("Network error while fetching tool schema.");
      return {
        tools: [],
      };
    }

    return resp.json();
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
