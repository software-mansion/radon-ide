import { getWorkspacePath } from "./common";
import { execWithLog } from "./subprocess";

export async function createWorkspaceFingerprint() {
  const result = await execWithLog(`npx @expo/fingerprint ${getWorkspacePath()}`, {});
  const parsedResult = JSON.parse(result.stdout);
  return parsedResult["hash"];
}
