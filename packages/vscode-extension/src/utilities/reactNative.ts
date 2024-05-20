import semver from "semver";
import { Logger } from "../Logger";
import { getAppRootFolder } from "./extensionContext";
import fs from "fs";
import path from "path";

export async function getReactNativeVersion() {
  const workspacePath = getAppRootFolder();
  const packageJsonPath = path.join(workspacePath, "package.json");

  try {
    const jsonString = await fs.promises.readFile(packageJsonPath, "utf8");
    const packageJson = JSON.parse(jsonString);
    return semver.valid(semver.coerce(packageJson!.dependencies["react-native"])) ?? "0.74.0";
  } catch (err) {
    Logger.debug("Error:", err);
  }

  return "0.74.0";
}
