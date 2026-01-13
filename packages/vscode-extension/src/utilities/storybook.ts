import path from "path";
import { SemVer, gte } from "semver";
import { ResolvedLaunchConfig } from "../project/ApplicationContext";
import {
  isApplicationDependencyInstalled,
  readApplicationDependencyVersion,
} from "./applicationDependencies";
import { MinSupportedVersion } from "../common/Constants";
import { extensionContext } from "./extensionContext";
import { exec } from "../utilities/subprocess";

type StorybookConfig =
  | {
      installed: false;
    }
  | {
      installed: true;
      version: SemVer;
      configPath: string;
    };

/**
 * Gets the Storybook configuration directory name based on the version.
 * @param version - The semantic version to check against.
 * @returns The configuration directory name: ".rnstorybook" for version 9.0.0 and above, ".storybook" for earlier versions.
 */
function getStorybookConfigDir(version: SemVer): string {
  return gte(version, "9.0.0") ? ".rnstorybook" : ".storybook";
}

export function isStorybookInstalled(appRoot: string) {
  return isApplicationDependencyInstalled(
    "@storybook/react-native",
    appRoot,
    MinSupportedVersion.storybook
  );
}

export async function getStorybookConfiguration(
  launchConfiguration: ResolvedLaunchConfig,
  customMetroConfigPath?: string
): Promise<StorybookConfig> {
  const appRoot = launchConfiguration.absoluteAppRoot;

  const installed = isStorybookInstalled(appRoot);

  if (!installed) {
    return { installed };
  }

  const version = readApplicationDependencyVersion(appRoot, "@storybook/react-native");

  if (!version) {
    throw new Error("[Storybook] If storybook installed it should always have a version.");
  }

  let configPath;

  const env = {
    ...launchConfiguration.env,
    ...(customMetroConfigPath ? { RN_IDE_METRO_CONFIG_PATH: customMetroConfigPath } : {}),
  };

  const configPathTesterScript = path.join(
    extensionContext.extensionPath,
    "lib",
    "storybook",
    "storybook_config_reader.js"
  );

  try {
    const result = await exec("node", [configPathTesterScript], {
      allowNonZeroExit: true,
      cwd: appRoot,
      env,
      quietErrorsOnExit: true,
    });
    if (result.exitCode === 0) {
      const stdout = result.stdout;
      const match = stdout.match(/RADON_STORYBOOK_CONFIG_PATH:(.+)/);
      configPath = match ? match[1].trim() : undefined;
    }
  } catch (e) {
    configPath = undefined;
  }

  if (!configPath) {
    configPath = path.join(appRoot, getStorybookConfigDir(version));
  }

  return {
    installed,
    version,
    configPath,
  };
}
