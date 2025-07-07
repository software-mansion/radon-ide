import { workspace } from "vscode";
import { LaunchConfigurationOptions } from "../common/LaunchConfig";

export function getLaunchConfiguration() {
  const ideConfig: LaunchConfigurationOptions =
    workspace.getConfiguration("launch")?.configurations?.find(isIdeConfig) ?? {};

  return ideConfig;
}

export function getLaunchConfigurations(): Array<LaunchConfigurationOptions> {
  const ideConfigs: LaunchConfigurationOptions[] =
    workspace.getConfiguration("launch")?.configurations?.filter(isIdeConfig) ?? [];

  return ideConfigs;
}

function isIdeConfig(config: any) {
  return config.type === "react-native-ide" || config.type === "radon-ide"; // we keep previous type name for compatibility with old configuration files
}
