import fs from "fs";
import semver from "semver";
import { Logger } from "../Logger";
import { requireNoCache } from "./requireNoCache";

// this is minimum supported version at the time this code was written, and therefore a default for this function,
// but this code should never be reached as react-native contains this information in its package json and reaching,
// this code suggests that the function was incorrectly called before installing node_modules.
const DEFAULT_MINIMUM_NODE_VERSION = ">=18";

function getReactNativeMinimumNodeVersion(appRoot: string): string | undefined {
  if (
    fs.existsSync(`${appRoot}/node_modules`) &&
    fs.existsSync(`${appRoot}/node_modules/react-native`)
  ) {
    const reactNativePackageJson = requireNoCache(
      `${appRoot}/node_modules/react-native/package.json`
    );
    if (reactNativePackageJson.engines && reactNativePackageJson.engines.node) {
      return reactNativePackageJson.engines.node;
    }
    return undefined;
  }
}

function getApplicationMinimumNodeVersion(appRoot: string): string | undefined {
  const appPackageJson = requireNoCache(`${appRoot}/package.json`);
  if (appPackageJson.engines && appPackageJson.engines.node) {
    return appPackageJson.engines.node;
  }
  return undefined;
}

/* 
This function return a minimum supported node version for given appRoot assuming node_modules are installed,
if node modules are not installed the function will return a default value, but it may be incorrect in future versions
of react native, so it should be always used after node_modules installation.
*/
export function getMinimumSupportedNodeVersion(appRoot: string): string {
  const applicationMinimumNodeVersion = getApplicationMinimumNodeVersion(appRoot);
  const reactNativeMinimumNodeVersion = getReactNativeMinimumNodeVersion(appRoot);

  if (reactNativeMinimumNodeVersion === undefined) {
    Logger.warn(
      "[Minimum Supported node version] Utility function called before node modules were installed, the returned value might, be deprecated."
    );
  }

  const ranges = [applicationMinimumNodeVersion, reactNativeMinimumNodeVersion].filter(
    (e) => e !== undefined
  );

  return ranges.reduce((mostRestrictive, current) => {
    const currentMinVersion = semver.minVersion(current);
    const restrictiveMinVersion = semver.minVersion(mostRestrictive);

    if (currentMinVersion && restrictiveMinVersion) {
      return semver.gt(currentMinVersion, restrictiveMinVersion) ? current : mostRestrictive;
    }
    return current || mostRestrictive;
  }, DEFAULT_MINIMUM_NODE_VERSION);
}
