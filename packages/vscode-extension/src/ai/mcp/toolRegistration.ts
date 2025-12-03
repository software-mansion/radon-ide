import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import vscode, { Disposable } from "vscode";
import {
  AppReloadRequest,
  readLogsToolExec,
  restartDeviceExec,
  screenshotToolExec,
  viewComponentTreeExec,
} from "./toolExecutors";
import { AI_API_PLACEHOLDER_ID, invokeToolCall } from "../shared/api";
import { textToToolResult, toolResponseToToolResult } from "./utils";
import { AuthorizationError } from "../../common/Errors";
import { ToolSchema } from "./models";

interface LibraryDescriptionToolArgs {
  library_npm_name: string;
}

class LibraryDescriptionTool implements vscode.LanguageModelTool<LibraryDescriptionToolArgs> {
  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<LibraryDescriptionToolArgs>
  ): Promise<vscode.LanguageModelToolResult> {
    const toolName = "get_library_description";
    try {
      const toolResponse = await invokeToolCall(toolName, options.input, AI_API_PLACEHOLDER_ID);
      return toolResponseToToolResult(toolResponse);
    } catch (error) {
      if (error instanceof AuthorizationError) {
        // This error is a fallback, as LLM tools should be disabled when no valid license is present.
        const msg = `You have to have a valid Radon IDE license to use the ${toolName} tool.`;
        return textToToolResult(msg);
      }

      return textToToolResult(String(error));
    }
  }
}

interface QueryDocumentationToolArgs {
  text: string;
}

class QueryDocumentationTool implements vscode.LanguageModelTool<QueryDocumentationToolArgs> {
  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<QueryDocumentationToolArgs>
  ): Promise<vscode.LanguageModelToolResult> {
    const toolName = "query_documentation";
    try {
      const toolResponse = await invokeToolCall(toolName, options.input, AI_API_PLACEHOLDER_ID);
      return toolResponseToToolResult(toolResponse);
    } catch (error) {
      if (error instanceof AuthorizationError) {
        // This error is a fallback, as LLM tools should be disabled when no valid license is present.
        const msg = `You have to have a valid Radon IDE license to use the ${toolName} tool.`;
        return textToToolResult(msg);
      }

      return textToToolResult(String(error));
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface EmptyToolArgs {}

class ViewScreenshotTool implements vscode.LanguageModelTool<EmptyToolArgs> {
  async invoke(): Promise<vscode.LanguageModelToolResult> {
    const toolResponse = await screenshotToolExec();
    return toolResponseToToolResult(toolResponse);
  }
}

class RestartDeviceTool implements vscode.LanguageModelTool<AppReloadRequest> {
  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<AppReloadRequest>
  ): Promise<vscode.LanguageModelToolResult> {
    const toolResponse = await restartDeviceExec(options.input);
    return toolResponseToToolResult(toolResponse);
  }
}

class ViewComponentTreeTool implements vscode.LanguageModelTool<EmptyToolArgs> {
  async invoke(): Promise<vscode.LanguageModelToolResult> {
    const toolResponse = await viewComponentTreeExec();
    return toolResponseToToolResult(toolResponse);
  }
}

class ViewApplicationLogsTool implements vscode.LanguageModelTool<EmptyToolArgs> {
  async invoke(): Promise<vscode.LanguageModelToolResult> {
    const toolResponse = await readLogsToolExec();
    return toolResponseToToolResult(toolResponse);
  }
}

export function registerStaticTools() {
  // TODO: Disable when license not available
  const queryDocumentationTool = vscode.lm.registerTool(
    "query_documentation",
    new QueryDocumentationTool()
  );

  // TODO: Disable when license not available
  const libraryDescriptionTool = vscode.lm.registerTool(
    "get_library_description",
    new LibraryDescriptionTool()
  );

  const viewScreenshotTool = vscode.lm.registerTool("view_screenshot", new ViewScreenshotTool());

  const reloadApplicationTool = vscode.lm.registerTool(
    "reload_application",
    new RestartDeviceTool()
  );

  const viewComponentTreeTool = vscode.lm.registerTool(
    "view_component_tree",
    new ViewComponentTreeTool()
  );

  const viewApplicationLogsTool = vscode.lm.registerTool(
    "view_application_logs",
    new ViewApplicationLogsTool()
  );

  return Disposable.from(
    queryDocumentationTool,
    libraryDescriptionTool,
    viewScreenshotTool,
    reloadApplicationTool,
    viewComponentTreeTool,
    viewApplicationLogsTool
  );
}

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
    "view_component_tree",
    {
      description:
        "Displays the component tree (view hierarchy) of the running app.\n" +
        "This tool only displays mounted components, so some parts of the project might not be visible.\n" +
        "Use this tool when a general overview of the UI is required, such as when resolving layout issues, looking for " +
        "location of context providers, or looking for relation between the project file structure and project component structure.",
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
