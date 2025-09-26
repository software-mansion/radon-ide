import path from "path";
import { DevicePlatform } from "../common/State";
import { extensionContext } from "../utilities/extensionContext";
import { fileExists } from "../utilities/fileExists";
import { exec } from "../utilities/subprocess";

export async function isDevClientProject(
  appRoot: string,
  platform: DevicePlatform
): Promise<boolean> {
  // There is no straightforward way to tell apart different react native project
  // setups. i.e. expo-go, expo-dev-client, bare react native, etc.
  // Here, we are using a heuristic to determine if the project is dev-client based
  // on the following factors:
  // 1) The project has app.json or app.config.js
  // 3) The dev_client_project_tester.js script runs successfully – the script uses expo-cli
  // internals to resolve project config and tells expo-go and dev-client apart.

  if (!fileExists(appRoot, "app.json") && !fileExists(appRoot, "app.config.js")) {
    // app.json or app.config.js is required for expo-dev-client projects
    return false;
  }

  const devClientProjectTesterScript = path.join(
    extensionContext.extensionPath,
    "lib",
    "expo",
    "dev_client_project_tester.js"
  );
  try {
    const result = await exec("node", [devClientProjectTesterScript], {
      cwd: appRoot,
      allowNonZeroExit: true,
    });
    return result.exitCode === 0;
  } catch (e) {
    return false;
  }
}
