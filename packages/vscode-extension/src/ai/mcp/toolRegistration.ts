import { z } from "zod";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getToolSchema, invokeToolCall } from "../shared/api";
import { ToolSchema } from "./models";
import { readLogsToolExec, restartDeviceExec, screenshotToolExec } from "./toolExecutors";
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
    "reload_application",
    {
      description:
        "Trigger a reload of the app running in the development emulator. Use this tool whenever you are debugging the state and want to reset it, or when the app crashes or breaks due to an interaction.\n" +
        "There are 3 ways you can reload the app:\n" +
        "- `reloadJs`: Causes the JS bundle to be reloaded, it does not trigger any rebuild or restart of the native part of the app. Use this to restart the JS state of the app.\n" +
        "- `restartProcess`: Restarts the native part of the app. Use this method for resetting state of bugged **NATIVE** libraries or components.\n" +
        "- `rebuild`: Rebuilds both the js and the native parts of the app. Use it whenever changes are made to the native part, as such changes require a full rebuild.",
      inputSchema: {
        reloadMethod: z.union([
          z.literal("reloadJs"),
          z.literal("restartProcess"),
          z.literal("rebuild"),
        ]),
      },
    },
    restartDeviceExec
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
