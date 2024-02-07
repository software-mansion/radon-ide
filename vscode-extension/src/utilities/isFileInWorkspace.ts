import { workspace, Uri } from "vscode";

export function isFileInWorkspace(filePath: string): boolean {
  return workspace.getWorkspaceFolder(Uri.file(filePath)) !== undefined;
}
