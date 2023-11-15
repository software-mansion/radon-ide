import { workspace } from "vscode";
import path from "path";

export function isFileInWorkspace(filePath: string): boolean {
  const workspaceDir = workspace.workspaceFolders?.[0]?.uri?.fsPath || "";
  // Get the relative path from the workspace directory to the file
  const relative = path.relative(workspaceDir, filePath);

  // If the relative path starts with "..", the file is outside the workspace
  return (
    !relative.startsWith("..") && !path.isAbsolute(relative) && !relative.startsWith("node_modules")
  );
}
