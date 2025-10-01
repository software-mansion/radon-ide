import { z } from "zod";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
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
        "Trigger a reload of the app running in the development emulator. The three methods of reloading the app are:\n" +
        "- `reloadJs`: This method triggers the JS bundle to be reloaded, it does not trigger any rebuild or restart of the native part of the app\n" +
        "- `restartProcess`: This method restarts the native part of the app. This method is useful for restarting the state of buggy native libraries or components.\n" +
        "- `rebuild`: This method rebuilds both the js and the native parts of the app. Use it whenever changes are made to the native part.",
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
