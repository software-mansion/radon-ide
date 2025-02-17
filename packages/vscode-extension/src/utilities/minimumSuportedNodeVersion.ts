import fs from "fs";
import { Logger } from "../Logger";

/* 
This function return a minimum supported node version for given appRoot assuming node_modules are installed,
if node modules are not installed the function will return a default value, but it may be incorrect in future versions
of react native, so it should be always used after node_modules installation.
*/
export function minimumSupportedNodeVersion(appRoot: string): string {
  const appPackageJson = require(`${appRoot}/package.json`);
  if (appPackageJson.engines && appPackageJson.engines.node) {
    return appPackageJson.engines.node;
  }

  if (
    fs.existsSync(`${appRoot}/node_modules`) &&
    fs.existsSync(`${appRoot}/node_modules/react-native`)
  ) {
    const reactNativePackageJson = require(`${appRoot}/node_modules/react-native/package.json`);
    if (reactNativePackageJson.engines && reactNativePackageJson.engines.node) {
      return reactNativePackageJson.engines.node;
    }
  }

  // this is minimum supported version at the time this code was written, and therefore a default for this function,
  // but this code should never be reached as react-native contains this information in its package json and reaching,
  // this code suggests that the function was incorrectly called before installing node_modules.
  Logger.warn(
    "[Minimum Supported node version] Utility function called before node modules were installed, the returned value might, be deprecated."
  );
  return ">=18";
}
