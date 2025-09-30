const fs = require("fs");
const path = require("path");

const appRoot = path.resolve();

function isWorkspaceRoot(dir) {
  const packageJsonPath = path.join(dir, "package.json");
  const nxJsonPath = path.join(dir, "nx.json");
  const pnpmWorkspaceYamlPath = path.join(dir, "pnpm-workspace.yaml");

  if (fs.existsSync(nxJsonPath) || fs.existsSync(pnpmWorkspaceYamlPath)) {
    return true;
  }

  try {
    const workspaces = require(packageJsonPath).workspaces;

    if (workspaces) {
      return true;
    }
  } catch (e) {
    // No "workspace" property in package.json precede
  }

  return false;
}

function findWorkspace(appRootPath) {
  let currentDir = appRootPath;
  let parentDir = path.resolve(currentDir, "..");
  while (parentDir !== currentDir) {
    currentDir = parentDir;
    parentDir = path.resolve(currentDir, "..");
    if (isWorkspaceRoot(currentDir)) {
      return currentDir;
    }
  }
  return undefined;
}

function resolvePnpmPackageFromAppRoot(moduleName) {
  try {
    const workspace = findWorkspace(appRoot);

    let packageName, subPath;
    if (moduleName.startsWith('@')) {
      // Scoped package like @babel/plugin-transform-react-jsx/lib/development
      const parts = moduleName.split('/');
      packageName = `${parts[0]}/${parts[1]}`; // @babel/plugin-transform-react-jsx
      subPath = parts.slice(2).join('/'); // lib/development
    } else {
      // Regular package like metro-config 
      const parts = moduleName.split('/');
      packageName = parts[0];
      subPath = parts.slice(1).join('/');
    }

    const nodeModulesPath = path.resolve(workspace, 'node_modules');
    const pnpmPath = path.join(nodeModulesPath, '.pnpm');

    if (fs.existsSync(pnpmPath)) {
      let searchPattern;

      if (packageName.startsWith('@')) {
        // For scoped packages like @babel/plugin-transform-react-jsx
        // pnpm creates directories like @babel+plugin-transform-react-jsx@version_deps
        const escapedPackageName = packageName.replace('/', '+');
        searchPattern = `${escapedPackageName}@`;
      } else {
        // For regular packages pnpm creates directories like packageName@version_deps
        searchPattern = `${packageName}@`;
      }

      const pnpmDirs = fs.readdirSync(pnpmPath);

      const moduleDir = pnpmDirs.find(dir =>
        dir.startsWith(searchPattern)
      );

      if (moduleDir) {
        let fullPath = path.join(pnpmPath, moduleDir, 'node_modules', packageName);
        if (subPath) {
          fullPath = path.join(fullPath, subPath);
        }

        // Try to resolve the path as-is first
        if (fs.existsSync(fullPath)) {
          try {
            return require.resolve(fullPath);
          } catch (e) {
            // we ignore errors here and continue
          }
        }

        // If the fullPath doesn't exist, try with common extensions
        if (subPath && !fs.existsSync(fullPath)) {
          const extensions = ['.js', '.json', '/index.js'];
          for (const ext of extensions) {
            const pathWithExt = fullPath + ext;
            if (fs.existsSync(pathWithExt)) {
              try {
                return require.resolve(pathWithExt);
              } catch (e) {
                // we ignore errors here and continue
              }
            }
          }
        }

        // Try require.resolve on the package root if no subPath worked
        if (subPath) {
          const packageRoot = path.join(pnpmPath, moduleDir, 'node_modules', packageName);
          try {
            return require.resolve(packageRoot);
          } catch (e) { }
        }
      }
    }
  } catch (e) {
    console.error("[resolve-pnpm-module]:", e);
  }
}

module.exports = { resolvePnpmPackageFromAppRoot };