import { workspace } from "vscode";

export type LaunchConfigurationOptions = {
  "iOS:scheme": string | undefined;
  "iOS:configuration": string | undefined;
  "Android:variant": string | undefined;
};

export function getLaunchConfiguration(): LaunchConfigurationOptions {
  return (
    workspace
      .getConfiguration("launch")
      ?.configurations?.find((config: any) => config.type === "react-native-ide") || {}
  );
}
