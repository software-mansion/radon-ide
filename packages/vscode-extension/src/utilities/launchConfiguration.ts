import { DebugConfiguration, workspace } from "vscode";
import { LaunchOptions } from "../common/LaunchConfig";

/**
 * Represents a launch configuration for Radon IDE, serialized into the format used in VS Code's launch.json.
 */
export interface LaunchRadonConfig extends LaunchOptions {
  name: string;
  type: "react-native-ide" | "radon-ide";
  request: "launch";
}

export function getLaunchConfiguration() {
  const ideConfig = workspace.getConfiguration("launch")?.configurations?.find(isIdeConfig) ?? {};

  return ideConfig;
}

export function getLaunchConfigurations(): Array<LaunchRadonConfig> {
  const ideConfigs =
    workspace.getConfiguration("launch")?.configurations?.filter(isIdeConfig) ?? [];

  return ideConfigs;
}

export function isIdeConfig(config: DebugConfiguration): config is LaunchRadonConfig {
  return config.type === "react-native-ide" || config.type === "radon-ide"; // we keep previous type name for compatibility with old configuration files
}
