import { createFingerprintAsync, createProjectHashAsync } from "@expo/fingerprint";
import { getWorkspacePath } from "./common";
import { Logger } from "../Logger";
import { execWithLog } from "./subprocess";

export async function createWorkspaceFingerprint() {
  const result = await execWithLog(`npx @expo/fingerprint ${getWorkspacePath()}`, {});
  const parsedResult = JSON.parse(result.stdout);
  return parsedResult["hash"];
}
