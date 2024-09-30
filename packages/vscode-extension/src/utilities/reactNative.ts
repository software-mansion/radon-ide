import path from "path";
import { getAppRootFolder } from "./extensionContext";

export async function getReactNativeVersion() {
  const workspacePath = getAppRootFolder();
  const reactNativeRoot = path.dirname(require.resolve("react-native", { paths: [workspacePath] }));
  const packageJsonPath = path.join(reactNativeRoot, "package.json");
  const packageJson = require(packageJsonPath);

  return packageJson.version ?? "0.74.0";
}
