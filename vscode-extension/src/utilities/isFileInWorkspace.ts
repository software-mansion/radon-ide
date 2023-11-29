import { workspace } from "vscode";
import path from "path";
import { getWorkspacePath } from "./common";

export function isFileInWorkspace(filePath: string): boolean {
  const workspaceDir = getWorkspacePath();
  // Get the relative path from the workspace directory to the file
  const relative = path.relative(workspaceDir, filePath);

  // If the relative path starts with "..", the file is outside the workspace
  return (
    !relative.startsWith("..") && !path.isAbsolute(relative) && !relative.startsWith("node_modules")
  );
}
