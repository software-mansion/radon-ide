import vscode, { commands, Disposable } from "vscode";
import { readLogsToolExec, screenshotToolExec, viewComponentTreeExec } from "./toolExecutors";
import { invokeToolCall } from "../shared/api";
import { textToToolResponse } from "./utils";
import { AuthorizationError } from "../../common/Errors";

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
      return await invokeToolCall(toolName, options.input, PLACEHOLDER_ID);
    } catch (error) {
      if (error instanceof AuthorizationError) {
        // This error is a fallback, as LLM tools should be disabled when no valid license is present.
        const msg = `You have to have a valid Radon IDE license to use the ${toolName} tool.`;
        return textToToolResponse(msg);
      }

      // TODO: Disable tools for users with no license
      return textToToolResponse(String(error));
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
      return await invokeToolCall(toolName, options.input, PLACEHOLDER_ID);
    } catch (error) {
      if (error instanceof AuthorizationError) {
        // This error is a fallback, as LLM tools should be disabled when no valid license is present.
        const msg = `You have to have a valid Radon IDE license to use the ${toolName} tool.`;
        return textToToolResponse(msg);
      }

      // TODO: Disable tools for users with no license
      return textToToolResponse(String(error));
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface EmptyToolArgs {}

export class ViewScreenshotTool implements vscode.LanguageModelTool<EmptyToolArgs> {
  async invoke(): Promise<vscode.LanguageModelToolResult> {
    // TODO: Add version checks for supporting this, as this feature was added in 1.105.
    // ref: https://github.com/microsoft/vscode/issues/245104
    return await screenshotToolExec();
  }
}

export class ViewComponentTreeTool implements vscode.LanguageModelTool<EmptyToolArgs> {
  async invoke(): Promise<vscode.LanguageModelToolResult> {
    return await viewComponentTreeExec();
  }
}

export class ViewApplicationLogsTool implements vscode.LanguageModelTool<EmptyToolArgs> {
  async invoke(): Promise<vscode.LanguageModelToolResult> {
    return await readLogsToolExec();
  }
}

// TODO: Find a better name
function updateExtensionContextShouldUseDirectRegistering() {
  commands.executeCommand("setContext", "RNIDE.useStaticToolRegistering", true);
}

function shouldUseDirectRegistering() {
  return (
    // @ts-ignore vscode.lm.registerTool API with image support only available in VSCode version 1.105+ (excluding Cursor)
    vscode.version.localeCompare("1.105.0", undefined, { numeric: true }) >= 0
  );
}

function registerMcpTools(): Disposable {
  return Disposable.from();
}

function registerStaticTools() {
  const queryDocumentationTool = vscode.lm.registerTool(
    "query_documentation",
    new ViewScreenshotTool()
  );

  const libraryDescriptionTool = vscode.lm.registerTool(
    "get_library_description",
    new ViewScreenshotTool()
  );

  const viewScreenshotTool = vscode.lm.registerTool("view_screenshot", new ViewScreenshotTool());

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
    viewComponentTreeTool,
    viewApplicationLogsTool
  );
}

export function registerRadonAI(): Disposable {
  updateExtensionContextShouldUseDirectRegistering();

  if (shouldUseDirectRegistering()) {
    return registerStaticTools();
  } else {
    return registerMcpTools();
  }
}
