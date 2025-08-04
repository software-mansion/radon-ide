import { z } from "zod";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import { getToolSchema, invokeToolCall } from "../shared/api";
import { ToolSchema } from "./models";
import { buildLogsToolExec, screenshotToolExec } from "./toolExecutors";
import { ConnectionListener } from "../shared/ConnectionListener";

const PLACEHOLDER_ID = "3241"; // This placeholder is needed by the API, but the value doesn't matter

function buildZodSchema(toolSchema: ToolSchema): z.ZodRawShape {
  const props = Object.values(toolSchema.inputSchema.properties);
  const entries = props.map((v) => [v.title, z.string()]);
  const obj = Object.fromEntries(entries);
  return obj;
}

export async function registerMcpTools(server: McpServer, connectionListener: ConnectionListener) {
  server.registerTool(
    "view_screenshot",
    {
      description: "Get a screenshot of the app development viewport.",
      inputSchema: {},
    },
    screenshotToolExec
  );

  server.registerTool(
    "view_debugging_data",
    {
      description:
        "Use this function to get all the build, bundling and application logs which are required for debugging the user's app.",
      inputSchema: {},
    },
    buildLogsToolExec
  );

  const toolSchema = await getToolSchema(connectionListener);

  for (const tool of toolSchema.tools) {
    const zodSchema = buildZodSchema(tool);
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: zodSchema,
      },
      async (args) => {
        return await invokeToolCall(tool.name, args, PLACEHOLDER_ID, connectionListener);
      }
    );
  }
}
