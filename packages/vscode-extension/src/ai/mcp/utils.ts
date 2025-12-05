import { Store } from "react-devtools-inline";
import vscode from "vscode";
import { DevtoolsElement, ImageContent, TextContent, ToolResponse } from "./models";

/**
 * Returns standard MCP image tool respose fragment.
 * May be used within `ToolResponse.content`.
 */
export function pngToToolContent(base64Encoded: string): ImageContent {
  return {
    type: "image",
    data: base64Encoded,
    mimeType: "image/png",
  };
}

/**
 * Returns standard MCP text tool respose fragment.
 * May be used within `ToolResponse.content`.
 */
export function textToToolContent(text: string): TextContent {
  return {
    type: "text",
    text,
  };
}

/**
 * Converts text to `ToolResponse`.
 * Required for usage within `vscode.lm.registerTool` tool definitions.
 */
export function textToToolResponse(text: string): ToolResponse {
  return {
    content: [textToToolContent(text)],
  };
}

function pngToDataPart(buffer: Buffer): vscode.LanguageModelDataPart {
  // @ts-ignore `vscode.LanguageModelDataPart` introduced in 1.105.0
  return vscode.LanguageModelDataPart.image(buffer, "image/png");
}

function textToTextPart(text: string): vscode.LanguageModelTextPart {
  return new vscode.LanguageModelTextPart(text);
}

/**
 * Converts text to `vscode.LanguageModelToolResult`.
 * Returned value may be used as the output of `vscode.LanguageModelTool.invoke` method.
 */
export function textToToolResult(text: string): vscode.LanguageModelToolResult {
  return new vscode.LanguageModelToolResult([textToTextPart(text)]);
}

/**
 * Converts `ToolResponse` to `vscode.LanguageModelToolResult`
 *
 * `vscode.lm.registerTool` requires `vscode.LanguageModelToolResult` as the tool output.
 * Internally, we still operate on the MCP-style `ToolResponse`, as it is required for:
 * - Cursor
 * - Chat participant
 * - Legacy VSCode support
 *
 * This function is required to bridge `ToolResponse` to a type suitable for `vscode.lm.registerTool`.
 */
export function toolResponseToToolResult(response: ToolResponse): vscode.LanguageModelToolResult {
  return {
    content: response.content.map((element) =>
      element.type === "text"
        ? textToTextPart(element.text)
        : pngToDataPart(Buffer.from(element.data, "base64"))
    ),
  };
}

/**
 * Removes the need for type-casting on every `store.getElementByID` call.
 */
export function getDevtoolsElementByID(id: number, store: Store): DevtoolsElement | null {
  return store.getElementByID(id) as unknown as DevtoolsElement | null;
}

/**
 * Finds and returns the `AppWrapper` in a component tree. Returns `null` if `AppWrapper` couldn't be found.
 */
export function findTreeEntryPoint(store: Store, element: DevtoolsElement): DevtoolsElement | null {
  if (element.key === "__RNIDE_APP_WRAPPER") {
    return element;
  }

  for (const childId of element.children) {
    const child = getDevtoolsElementByID(childId, store);

    if (!child) {
      throw new Error(`Component tree is corrupted. Element with ID ${childId} not found.`);
    }

    const entryPoint = findTreeEntryPoint(store, child);

    if (entryPoint) {
      return entryPoint;
    }
  }

  return null;
}
