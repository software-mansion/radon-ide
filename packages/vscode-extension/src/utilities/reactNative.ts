import path from "path";

export function getReactNativeVersion(workspacePath: string) {
  const reactNativeRoot = path.dirname(require.resolve("react-native", { paths: [workspacePath] }));
  const packageJsonPath = path.join(reactNativeRoot, "package.json");
  const packageJson = require(packageJsonPath);

  return packageJson.version ?? "0.74.0";
}
