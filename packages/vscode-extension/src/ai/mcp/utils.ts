import { Store } from "react-devtools-inline";
import vscode from "vscode";
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

// @ts-ignore `vscode.LanguageModelDataPart` introduced in 1.105.0
export function pngToDataPart(buffer: Buffer<ArrayBufferLike>): vscode.LanguageModelDataPart {
  // @ts-ignore
  return vscode.LanguageModelDataPart.image(buffer, "image/png");
}

export function textToTextPart(text: string): vscode.LanguageModelTextPart {
  return new vscode.LanguageModelTextPart(text);
}

export function textToToolResult(text: string): vscode.LanguageModelToolResult {
  return {
    content: [textToToolContent(text)],
  };
}

// This util removes the need for type-casting on every `store.getElementByID` call
export function getDevtoolsElementByID(id: number, store: Store): DevtoolsElement | null {
  return store.getElementByID(id) as unknown as DevtoolsElement | null;
}
