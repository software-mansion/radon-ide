import { LiteMCP } from "litemcp";
import { z } from "zod";

import { getToolSchema, invokeToolCall } from "../shared/api";
import { ToolResponse, ToolSchema } from "./models";
import { screenshotToolDef } from "./toolDefinitions";

function buildZodSchema(toolSchema: ToolSchema): z.ZodType<unknown, z.ZodTypeDef, unknown> {
  const props = Object.values(toolSchema.inputSchema.properties);
  const entries = props.map((v) => [v.title, z.string()]);
  const obj = z.object(Object.fromEntries(entries));
  return obj;
}

export async function registerMcpTools(server: LiteMCP) {
  server.addTool({
    name: "view_screenshot",
    description: "Get a screenshot of the app development viewport.",
    execute: screenshotToolDef,
  });

  const toolSchema = await getToolSchema();

  for (const tool of toolSchema.tools) {
    const zodSchema = buildZodSchema(tool);
    server.addTool({
      name: tool.name,
      description: tool.description,
      parameters: zodSchema,
      execute: async (args): Promise<ToolResponse> => {
        return await invokeToolCall(tool.name, args);
      },
    });
  }
}
