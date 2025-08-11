import path from "path";
import { OutputChannel } from "vscode";
import { requireNoCache } from "./requireNoCache";
import { ResolvedLaunchConfig } from "../project/ApplicationContext";
import { AndroidLocalBuildConfig, IOSLocalBuildConfig } from "../common/BuildConfig";
import { exec, lineReader } from "./subprocess";
import { DevicePlatform } from "../common/State";

export function shouldUseExpoCLI(launchConfig: ResolvedLaunchConfig) {
  // The mechanism for detecting whether the project should use Expo CLI or React Native Community CLI works as follows:
  // We check launch configuration, which has an option to force Expo CLI, we verify that first and if it is set to true we use Expo CLI.
  // When the Expo option isn't set, we need all of the below checks to be true in order to use Expo CLI:
  // 1. expo cli package is present in the app's node_modules (we can resolve it using require.resolve)
  // 2. package.json has expo scripts in it (i.e. "expo start" or "expo build" scripts are present in the scripts section of package.json)
  // 3. the user doesn't use a custom metro config option – this is only available for RN CLI projects
  const appRoot = launchConfig.absoluteAppRoot;
  if (launchConfig.isExpo) {
    return true;
  }

  if (launchConfig.metroConfigPath) {
    return false;
  }

  let hasExpoCLIInstalled = false;
  let hasExpoCommandsInScripts = false;
  let hasExpoConfigInAppJson = false;
  let hasExpoConfigInAppConfigJs = false;
  try {
    hasExpoCLIInstalled =
      require.resolve("@expo/cli/build/src/start/index", {
        paths: [appRoot],
      }) !== undefined;
  } catch (e) {}

  try {
    const appJson = requireNoCache(path.join(appRoot, "app.json"));
    hasExpoConfigInAppJson = Object.keys(appJson).includes("expo");
  } catch (e) {}

  try {
    const appConfigJs = requireNoCache(path.join(appRoot, "app.config.js"));
    hasExpoConfigInAppConfigJs = Object.keys(appConfigJs).includes("expo");
  } catch (e) {}

  try {
    const packageJson = requireNoCache(path.join(appRoot, "package.json"));
    hasExpoCommandsInScripts = Object.values<string>(packageJson.scripts).some((script: string) => {
      return script.includes("expo ");
    });
  } catch (e) {}

  return (
    hasExpoCLIInstalled &&
    (hasExpoCommandsInScripts || hasExpoConfigInAppJson || hasExpoConfigInAppConfigJs)
  );
}

function getExpoCliPath(appRoot: string) {
  try {
    return require.resolve("@expo/cli", {
      paths: [appRoot],
    });
  } catch {
    return undefined;
  }
}

export function runPrebuild(
  buildConfig: IOSLocalBuildConfig | AndroidLocalBuildConfig,
  outputChannel: OutputChannel
) {
  const appRoot = buildConfig.appRoot;
  const cliPath = getExpoCliPath(appRoot);
  if (!cliPath) {
    throw new Error(
      "Prebuild could not run because Expo CLI not installed in the project. Verify you have `@expo/cli` in your dependencies."
    );
  }
  const platform = buildConfig.platform === DevicePlatform.Android ? "android" : "ios";
  const args = [cliPath, "prebuild", "-p", platform];
  // NOTE: We handle installing node dependencies and pods ourselves, so we skip it in the prebuild.
  args.push("--no-install");
  if (buildConfig.forceCleanBuild) {
    args.push("--clean");
  }

  const process = exec("node", args, { cwd: appRoot });

  lineReader(process).onLineRead((line) => {
    outputChannel.appendLine(line);
  });

  return process;
}
