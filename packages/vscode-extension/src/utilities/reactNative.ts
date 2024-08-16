import { configureAppRootFolder } from "../extension";
import { getAppRootFolder } from "./extensionContext";
import path from "path";

export async function getReactNativeVersion() {
  await configureAppRootFolder();

  const workspacePath = getAppRootFolder();
  const reactNativeRoot = path.dirname(require.resolve("react-native", { paths: [workspacePath] }));
  const packageJsonPath = path.join(reactNativeRoot, "package.json");
  const packageJson = require(packageJsonPath);

  return packageJson.version ?? "0.74.0";
}
