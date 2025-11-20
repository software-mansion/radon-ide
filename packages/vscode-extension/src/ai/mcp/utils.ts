import { Store } from "react-devtools-inline";
import vscode from "vscode";
import { DevtoolsElement } from "./models";

export function pngToToolContent(base64Encoded: string): vscode.LanguageModelDataPart {
  return vscode.LanguageModelDataPart.image(Uint8Array.from(base64Encoded), "image/png");
}

export function textToToolContent(text: string): vscode.LanguageModelTextPart {
  return new vscode.LanguageModelTextPart(text);
}

export function textToToolResponse(text: string): vscode.LanguageModelToolResult {
  return {
    content: [textToToolContent(text)],
  };
}

// This util removes the need for type-casting on every `store.getElementByID` call
export function getDevtoolsElementByID(id: number, store: Store): DevtoolsElement | null {
  return store.getElementByID(id) as unknown as DevtoolsElement | null;
}
