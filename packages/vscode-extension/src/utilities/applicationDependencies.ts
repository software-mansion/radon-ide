import path from "path";
import { requireNoCache } from "./requireNoCache";
import semver, { SemVer } from "semver";

export function readApplicationDependencyVersion(
  appRoot: string,
  dependency: string
): SemVer | null {
  let version = null;

  try {
    // Resolve the package's main entry point
    const resolvedPath = require.resolve(dependency, { paths: [appRoot] });

    // Navigate up to find the package.json
    // For scoped packages like @storybook/react-native, the structure is:
    // node_modules/@storybook/react-native/dist/index.js (or similar)
    // We need to find the package root by looking for package.json
    let currentDir = path.dirname(resolvedPath);
    let packageJsonPath = null;

    // Search up the directory tree for package.json
    for (let i = 0; i < 10; i++) {
      const candidatePath = path.join(currentDir, "package.json");
      try {
        const pkg = requireNoCache(candidatePath);
        if (pkg.name === dependency) {
          packageJsonPath = candidatePath;
          break;
        }
      } catch (_) {
        // Continue searching
      }
      const parentDir = path.dirname(currentDir);
      if (parentDir === currentDir) break; // Reached root
      currentDir = parentDir;
    }

    if (packageJsonPath) {
      const module = requireNoCache(packageJsonPath);
      version = semver.coerce(module.version);
    }
  } catch (_error) {
    // ignore if not installed
  }

  return version;
}

export function isApplicationDependencyInstalled(
  dependency: string,
  appRoot: string,
  minVersion?: string | SemVer
) {
  const dependencyVersion = readApplicationDependencyVersion(appRoot, dependency);

  if (dependencyVersion === null) {
    return false;
  }

  if (!minVersion || semver.gte(dependencyVersion, new SemVer(minVersion))) {
    return true;
  }

  return false;
}
