import vscode, { commands, Disposable, ExtensionContext } from "vscode";
import {
  AppReloadRequest,
  readLogsToolExec,
  restartDeviceExec,
  screenshotToolExec,
  viewComponentTreeExec,
} from "./toolExecutors";
import { invokeToolCall } from "../shared/api";
import { textToToolResponse, textToToolResult, toolResponseToToolResult } from "./utils";
import { AuthorizationError } from "../../common/Errors";
import { RadonMcpController } from "./RadonMcpController";

const PLACEHOLDER_ID = "1234";

interface LibraryDescriptionToolArgs {
  library_npm_name: string;
}

export class LibraryDescriptionTool
  implements vscode.LanguageModelTool<LibraryDescriptionToolArgs>
{
  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<LibraryDescriptionToolArgs>
  ): Promise<vscode.LanguageModelToolResult> {
    const toolName = "get_library_description";
    try {
      const toolResponse = await invokeToolCall(toolName, options.input, PLACEHOLDER_ID);
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

export class QueryDocumentationTool
  implements vscode.LanguageModelTool<QueryDocumentationToolArgs>
{
  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<QueryDocumentationToolArgs>
  ): Promise<vscode.LanguageModelToolResult> {
    const toolName = "query_documentation";
    try {
      const toolResponse = await invokeToolCall(toolName, options.input, PLACEHOLDER_ID);
      return toolResponseToToolResult(toolResponse);
    } catch (error) {
      if (error instanceof AuthorizationError) {
        // This error is a fallback, as LLM tools should be disabled when no valid license is present.
        const msg = `You have to have a valid Radon IDE license to use the ${toolName} tool.`;
        return textToToolResponse(msg);
      }

      return textToToolResponse(String(error));
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface EmptyToolArgs {}

export class ViewScreenshotTool implements vscode.LanguageModelTool<EmptyToolArgs> {
  async invoke(): Promise<vscode.LanguageModelToolResult> {
    const toolResponse = await screenshotToolExec();
    return toolResponseToToolResult(toolResponse);
  }
}

export class RestartDeviceTool implements vscode.LanguageModelTool<AppReloadRequest> {
  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<AppReloadRequest>
  ): Promise<vscode.LanguageModelToolResult> {
    const toolResponse = await restartDeviceExec(options.input);
    return toolResponseToToolResult(toolResponse);
  }
}

export class ViewComponentTreeTool implements vscode.LanguageModelTool<EmptyToolArgs> {
  async invoke(): Promise<vscode.LanguageModelToolResult> {
    const toolResponse = await viewComponentTreeExec();
    return toolResponseToToolResult(toolResponse);
  }
}

export class ViewApplicationLogsTool implements vscode.LanguageModelTool<EmptyToolArgs> {
  async invoke(): Promise<vscode.LanguageModelToolResult> {
    const toolResponse = await readLogsToolExec();
    return toolResponseToToolResult(toolResponse);
  }
}

// TODO: Find a better name
function setGlobalUseDirectToolRegistering(useStaticRegistering: boolean) {
  commands.executeCommand("setContext", "RNIDE.useStaticToolRegistering", useStaticRegistering);
}

function shouldUseDirectRegistering() {
  return (
    // @ts-ignore vscode.lm.registerTool API with image support only available in VSCode version 1.105+ (excluding Cursor)
    vscode.version.localeCompare("1.105.0", undefined, { numeric: true }) >= 0
  );
}

function registerStaticTools() {
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

export function registerRadonAI(context: ExtensionContext): Disposable {
  const useStaticRegistering = shouldUseDirectRegistering();
  setGlobalUseDirectToolRegistering(useStaticRegistering);
  if (useStaticRegistering) {
    return registerStaticTools();
  } else {
    return new RadonMcpController(context);
  }
}
