import { workspace } from "vscode";
import { LaunchJsonEntry } from "../common/LaunchConfig";

export function getLaunchConfiguration() {
  const ideConfig: LaunchJsonEntry =
    workspace.getConfiguration("launch")?.configurations?.find(isIdeConfig) ?? {};

  return ideConfig;
}

export function getLaunchConfigurations(): Array<LaunchJsonEntry> {
  const ideConfigs: LaunchJsonEntry[] =
    workspace.getConfiguration("launch")?.configurations?.filter(isIdeConfig) ?? [];

  return ideConfigs;
}

function isIdeConfig(config: any) {
  return config.type === "react-native-ide" || config.type === "radon-ide"; // we keep previous type name for compatibility with old configuration files
}
