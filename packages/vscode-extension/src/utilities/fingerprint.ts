import path from "path";
import { createFingerprintAsync } from "@expo/fingerprint";
import { Logger } from "../Logger";
import { getAppRootFolder } from "./extensionContext";

const IGNORE_PATHS = [
  path.join("android", ".gradle/**/*"),
  path.join("android", "build/**/*"),
  path.join("android", "app", "build/**/*"),
  path.join("ios", "build/**/*"),
  "**/node_modules/**/android/.cxx/**/*",
  "**/node_modules/**/.gradle/**/*",
  "**/node_modules/**/android/build/intermediates/cxx/**/*",
];

export async function generateWorkspaceFingerprint() {
  const fingerprint = await createFingerprintAsync(getAppRootFolder(), {
    ignorePaths: IGNORE_PATHS,
  });
  Logger.log("New workspace fingerprint", fingerprint.hash);
  return fingerprint.hash;
}
