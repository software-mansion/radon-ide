import { workspace } from "vscode";
import { LaunchConfigurationOptions } from "../common/LaunchConfig";
import { extensionContext } from "./extensionContext";

export function getSkipFiles() {
  const extensionPath = extensionContext.extensionUri.path;

  const baseSkipFiles = [
    "__source__",
    `${extensionPath}/**/*`,
    "**/node_modules/**/*",
    "!**/node_modules/expo-router/**/*",
  ];

  const customSkipFiles = getLaunchConfiguration().skipFiles;
  if (customSkipFiles) {
    return [...baseSkipFiles, ...customSkipFiles];
  } else {
    return baseSkipFiles;
  }
}

export function getLaunchConfiguration() {
  const ideConfig: LaunchConfigurationOptions =
    workspace.getConfiguration("launch")?.configurations?.find(isIdeConfig) ?? {};

  return ideConfig;
}

function isIdeConfig(config: any) {
  return config.type === "react-native-ide" || config.type === "radon-ide"; // we keep previous type name for compatibility with old configuration files
}
