import { z } from "zod";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { invokeToolCall } from "../shared/api";
import { ToolSchema } from "./models";
import { readLogsToolExec, screenshotToolExec, viewComponentTreeExec } from "./toolExecutors";

export function registerLocalMcpTools(server: McpServer) {
  server.registerTool(
    "view_screenshot",
    {
      description: "Get a screenshot of the app development viewport.",
      inputSchema: {},
    },
    screenshotToolExec
  );

  server.registerTool(
    "view_component_tree",
    {
      description:
        "View the component tree (view hierarchy) of the running app. Use this tool to learn about the structure of this project.",
      inputSchema: {},
    },
    viewComponentTreeExec
  );

  server.registerTool(
    "view_application_logs",
    {
      description:
        "Returns all the build, bundling and runtime logs. Use this function whenever the user has any issue with the app, " +
        "if it's builds are failing, or when there are errors in the console. These logs are always a useful debugging aid.",
      inputSchema: {},
    },
    readLogsToolExec
  );
}

function buildZodSchema(toolSchema: ToolSchema): z.ZodRawShape {
  const props = Object.values(toolSchema.inputSchema.properties);
  const entries = props.map((v) => [v.title, z.string()]);
  const obj = Object.fromEntries(entries);
  return obj;
}

export function registerRemoteMcpTool(
  server: McpServer,
  tool: ToolSchema,
  invokeToolErrorHandler: (error: Error) => void
) {
  const registeredTool = server.registerTool(
    tool.name,
    {
      description: tool.description,
      inputSchema: buildZodSchema(tool),
    },
    async (args) => {
      try {
        return await invokeToolCall(tool.name, args);
      } catch (error) {
        invokeToolErrorHandler(error as Error);
        throw error;
      }
    }
  );
  return registeredTool;
}
