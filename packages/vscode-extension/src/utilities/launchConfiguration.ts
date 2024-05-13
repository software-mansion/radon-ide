import { workspace } from "vscode";

export type LaunchConfigurationOptions = {
  appRoot?: string;
  metroConfigPath?: string;
  env?: Record<string, string>;
  ios?: {
    scheme?: string;
    configuration?: string;
  };
  android?: {
    variant?: string;
  };
  preview?: {
    waitForAppLaunch?: boolean;
  };
};

export function getLaunchConfiguration(): LaunchConfigurationOptions {
  return (
    workspace
      .getConfiguration("launch")
      ?.configurations?.find((config: any) => config.type === "react-native-ide") || {}
  );
}
