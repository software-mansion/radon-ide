import { workspace } from "vscode";
import { LaunchConfigurationOptions } from "../common/LaunchConfig";

export function getLaunchConfiguration() {
  const ideConfig: LaunchConfigurationOptions =
    workspace.getConfiguration("launch")?.configurations?.find(isIdeConfig) ?? {};

  return ideConfig;
}

function isIdeConfig(config: any) {
  return config.type === "react-native-ide" || config.type === "radon-ide"; // we keep previous type name for compatibility with old configuration files
}
