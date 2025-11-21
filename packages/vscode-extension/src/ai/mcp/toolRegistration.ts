import vscode, { Disposable } from "vscode";
import { screenshotToolExec } from "./toolExecutors";
import { invokeToolCall } from "../shared/api";
import { textToToolResponse } from "./utils";
import { AuthorizationError } from "../../common/Errors";

const PLACEHOLDER_ID = "1234";

/*

view_screenshot: Get a screenshot of the app development viewport.

view_component_tree: Displays the component tree (view hierarchy) of the running app.\n
This tool only displays mounted components, so some parts of the project might not be visible.\n
Use this tool when a general overview of the UI is required, such as when resolving layout issues, looking for 
location of context providers, or looking for relation between the project file structure and project component structure

view_application_logs: Returns all the build, bundling and runtime logs. Use this function whenever the user has any issue with the app, 
if it's builds are failing, or when there are errors in the console. These logs are always a useful debugging aid.

get_library_description:


query_documentation: 


*/

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
    // TODO: Add version checks for supporting this, as this feature was added in 1.105.
    // ref: https://github.com/microsoft/vscode/issues/245104
    return await screenshotToolExec();
  }
}

export function registerRadonAI(): Disposable {
  const queryDocumentationTool = vscode.lm.registerTool(
    "query_documentation",
    new ViewScreenshotTool()
  );

  const libraryDescriptionTool = vscode.lm.registerTool(
    "get_library_description",
    new ViewScreenshotTool()
  );

  const viewScreenshotTool = vscode.lm.registerTool("view_screenshot", new ViewScreenshotTool());

  return Disposable.from(queryDocumentationTool, libraryDescriptionTool, viewScreenshotTool);
}
