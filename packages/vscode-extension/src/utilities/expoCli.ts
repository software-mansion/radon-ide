import path from "path";
import { getAppRootFolder } from "./extensionContext";
import { getLaunchConfiguration } from "./launchConfiguration";

export function shouldUseExpoCLI() {
  // The mechanism for detecting whether the project should use Expo CLI or React Native Community CLI works as follows:
  // We check launch configuration, which has an option to force Expo CLI, we verify that first and if it is set to true we use Expo CLI.
  // When the Expo option isn't set, we need all of the below checks to be true in order to use Expo CLI:
  // 1. expo cli package is present in the app's node_modules (we can resolve it using require.resolve)
  // 2. package.json has expo scripts in it (i.e. "expo start" or "expo build" scripts are present in the scripts section of package.json)
  // 3. the user doesn't use a custom metro config option – this is only available for RN CLI projects
  const config = getLaunchConfiguration();
  if (config.isExpo) {
    return true;
  }

  if (config.metroConfigPath) {
    return false;
  }

  const appRootFolder = getAppRootFolder();
  let hasExpoCLIInstalled = false,
    hasExpoCommandsInScripts = false,
    hasExpoConfigInAppJson = false;
  try {
    hasExpoCLIInstalled =
      require.resolve("@expo/cli/build/src/start/index", {
        paths: [appRootFolder],
      }) !== undefined;
  } catch (e) {}

  try {
    const appJson = require(path.join(appRootFolder, "app.json"));
    hasExpoConfigInAppJson = Object.keys(appJson).includes("expo");
  } catch (e) {}

  try {
    const packageJson = require(path.join(appRootFolder, "package.json"));
    hasExpoCommandsInScripts = Object.values<string>(packageJson.scripts).some((script: string) => {
      return script.includes("expo ");
    });
  } catch (e) {}

  return hasExpoCLIInstalled && (hasExpoCommandsInScripts || hasExpoConfigInAppJson);
}
