import { workspace } from "vscode";
import { LaunchConfigurationOptions } from "../common/LaunchConfig";

function isIdeConfig(config: any) {
  return config.type === "react-native-ide" || config.type === "radon-ide"; // we keep previous type name for compatibility with old configuration files
}

function assertValidConfig({ buildScript, eas }: LaunchConfigurationOptions) {
  for (const platform of ["ios", "android"] as const) {
    const buildScriptConfig = buildScript?.[platform];
    const easConfig = eas?.[platform];

    const illegalCustomBuildConfig = buildScriptConfig && easConfig;
    if (illegalCustomBuildConfig) {
      throw new Error(
        `RN IDE doesn't support both custom build scripts and EAS Build configuration (${platform}). Please remove one of them.`
      );
    }

    const missingBuildId = easConfig?.useBuildType === "id" && easConfig?.buildUUID === undefined;
    if (missingBuildId) {
      throw new Error(
        `EAS Build configuration for ${platform} is missing 'buildUUID' (using "id" for selecting build).`
      );
    }
  }
}

export function getLaunchConfiguration() {
  const ideConfig: LaunchConfigurationOptions = workspace
    .getConfiguration("launch")
    ?.configurations?.find(isIdeConfig);

  if (!ideConfig) {
    return {};
  }

  assertValidConfig(ideConfig);

  return ideConfig;
}
