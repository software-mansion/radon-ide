import vscode from "vscode";

// Here we open the url in the default user's browser.
export function openExternalUrl(url: string) {
  vscode.env.openExternal(vscode.Uri.parse(url));
}
