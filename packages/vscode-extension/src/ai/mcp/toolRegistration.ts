import vscode, { Disposable } from "vscode";
import { screenshotToolExec } from "./toolExecutors";

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

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface ViewScreenshotToolArgs {}

export class ViewScreenshotTool implements vscode.LanguageModelTool<ViewScreenshotToolArgs> {
  async invoke(): Promise<vscode.LanguageModelToolResult> {
    // NOTE: Image outputs are not supported by static tool definitions.
    // ref: https://github.com/microsoft/vscode/issues/245104
    // TODO: Check if this still applies in 1.105, it shouldn't.
    // TODO: Add version checks for supporting this.
    return await screenshotToolExec();
  }
}

export function registerRadonAI(): Disposable {
  const viewScreenshotTool = vscode.lm.registerTool("view_screenshot", new ViewScreenshotTool());
  return Disposable.from(viewScreenshotTool);
}
