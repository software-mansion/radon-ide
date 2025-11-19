import { Store } from "react-devtools-inline";
import { workspace } from "vscode";
import { DevtoolsElement, ImageContent, TextContent, ToolResponse } from "./models";

export function pngToToolContent(base64Encoded: string): ImageContent {
  return {
    type: "image",
    data: base64Encoded,
    mimeType: "image/png",
  };
}

export function textToToolContent(text: string): TextContent {
  return {
    type: "text",
    text,
  };
}

export function textToToolResponse(text: string): ToolResponse {
  return {
    content: [textToToolContent(text)],
  };
}

// This util removes the need for type-casting on every `store.getElementByID` call
export function getDevtoolsElementByID(id: number, store: Store): DevtoolsElement | null {
  return store.getElementByID(id) as unknown as DevtoolsElement | null;
}

export function isRadonEnabledInSettings() {
  return workspace.getConfiguration("RadonIDE").get<boolean>("radonAI.enabledBoolean") ?? true;
}
