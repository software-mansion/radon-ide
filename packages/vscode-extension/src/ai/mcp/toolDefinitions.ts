import vscode from "vscode";
import { screenshotToolExec } from "./toolExecutors";
import { invokeToolCall } from "../shared/api";
import { textToToolResponse } from "./utils";
import { AuthorizationError } from "./AuthorizationError";

const PLACEHOLDER_ID = "1234";

interface LibraryDescriptionToolArgs {
  library_npm_name: string;
}

export class LibraryDescriptionTool
  implements vscode.LanguageModelTool<LibraryDescriptionToolArgs>
{
  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<LibraryDescriptionToolArgs>,
    token: vscode.CancellationToken
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
    options: vscode.LanguageModelToolInvocationOptions<QueryDocumentationToolArgs>,
    token: vscode.CancellationToken
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
interface ViewScreenshotToolArgs {}

export class ViewScreenshotTool implements vscode.LanguageModelTool<ViewScreenshotToolArgs> {
  async invoke(): Promise<vscode.LanguageModelToolResult> {
    // NOTE: Image outputs are not supported by static tool definitions.
    // ref: https://github.com/microsoft/vscode/issues/245104
    return await screenshotToolExec();
  }
}
