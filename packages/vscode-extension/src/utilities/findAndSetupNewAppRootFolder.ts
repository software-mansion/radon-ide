import { window } from "vscode";
import { migrateOldBuildCachesToNewStorage } from "../builders/BuildCache";
import { Logger } from "../Logger";
import { findAppRootFolder } from "./extensionContext";
import { Platform } from "./platform";
import { setupPathEnv } from "./subprocess";

export function findAndSetupNewAppRootFolder() {
  const newAppRoot = findAppRootFolder();
  if (!newAppRoot) {
    window.showErrorMessage(
      "Failed to determine any application root candidates, you can set it up manually in launch configuration",
      "Dismiss"
    );
    Logger.error("[Project] The application root could not be found.");
    throw Error(
      "Couldn't find app root folder. The extension should not be activated without reachable app root."
    );
  }

  Logger.info(`Found app root folder: ${newAppRoot}`);
  migrateOldBuildCachesToNewStorage(newAppRoot);

  if (Platform.OS === "macos") {
    try {
      setupPathEnv(newAppRoot);
    } catch (error) {
      window.showWarningMessage(
        "Error when setting up PATH environment variable, RN IDE may not work correctly.",
        "Dismiss"
      );
    }
  }
  return newAppRoot;
}
