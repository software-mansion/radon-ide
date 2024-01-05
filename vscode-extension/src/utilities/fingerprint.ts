import path from "path";
import { Logger } from "../Logger";
import { execWithLog } from "./subprocess";
import { getWorkspacePath } from "./common";
import { createFingerprintAsync } from "@expo/fingerprint";

const IGNORE_PATHS = [
  path.join("android", ".gradle/**/*"),
  path.join("android", "build/**/*"),
  path.join("android", "app", "build/**/*"),
  path.join("ios", "build/**/*"),
  "**/node_modules/**/android/.cxx/**/*",
  "**/node_modules/**/android/build/intermediates/cxx/**/*",
];

export async function generateWorkspaceFingerprint() {
  const fingerprint = await createFingerprintAsync(getWorkspacePath(), {
    ignorePaths: IGNORE_PATHS,
  });
  Logger.log(["FINGERPRINT: ----------------", fingerprint.hash, "------------------"]);
  return fingerprint.hash;
}
