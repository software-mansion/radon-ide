import { command } from "./subprocess";
import { existsSync, promises as fs } from "fs";
import path, { resolve } from "path";
import { getAppRootFolder } from "./extensionContext";
import { Logger } from "../Logger";

export type PackageManagerInfo = {
  name: "npm" | "pnpm" | "yarn" | "bun";
  workspacePath?: string;
};

async function pathExists(p: string) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

export async function resolvePackageManager(): Promise<PackageManagerInfo> {
  function findWorkspace(appRoot: string) {
    let currentDir = appRoot;
    let parentDir = path.resolve(currentDir, "..");
    while (parentDir !== currentDir) {
      currentDir = parentDir;
      parentDir = path.resolve(currentDir, "..");
      const packageJsonPath = path.join(currentDir, "package.json");
      if (!existsSync(packageJsonPath)) {
        continue;
      }
      const workspaces = require(packageJsonPath).workspaces;
      if (!workspaces) {
        continue;
      }
      return currentDir;
    }
    return undefined;
  }

  const appRootPath = getAppRootFolder();
  const workspacePath = findWorkspace(appRootPath);

  async function findPackageManager(workspacePath: string) {
    return await Promise.all([
      pathExists(resolve(workspacePath, "yarn.lock")),
      pathExists(resolve(workspacePath, "package-lock.json")),
      pathExists(resolve(workspacePath, "pnpm-lock.yaml")),
      pathExists(resolve(workspacePath, "bun.lockb")),
    ]).then(([isYarn, isNpm, isPnpm, isBun]) => {
      if (isYarn) {
        return "yarn";
      } else if (isPnpm) {
        return "pnpm";
      } else if (isBun) {
        return "bun";
      } else if (isNpm) {
        return "npm";
      }
      try {
        const packageManager = require(path.join(workspacePath, "package.json")).packageManager;

        if (packageManager) {
          const regex = /^([a-zA-Z]+)@/;
          const match = packageManager.match(regex);
          return match ? match[1] : "npm";
        }
      } catch (e) {
        // there might be a problem while reading package.json in which case we default to npm
      }
      return "npm";
    });
  }

  const name = await findPackageManager(workspacePath ?? appRootPath);

  return { name, workspacePath };
}

export function isPackageManagerAvailable(manager: PackageManagerInfo): boolean {
  try {
    command(`${manager.name} --version`);
    return true;
  } catch {}
  return false;
}

async function isNpmModulesInstalled(workspacePath: string): Promise<boolean> {
  try {
    const { stdout, stderr } = await command("npm ls --json", {
      cwd: workspacePath,
      quiet: true,
    });
    const parsedJson = JSON.parse(stdout);
    return parsedJson.problems ? false : true;
  } catch (e) {
    return false;
  }
}

async function isYarnModulesInstalled(workspacePath: string): Promise<boolean> {
  try {
    // because "yarn check" was removed from yarnv2 we use npm's method for checking dependencies
    // npm is taking into consideration yarn.lock since version 7, which means
    // that if the users shell is using the older one this function may produce false in unexpected ways but even then
    // we'll just run "yarn install" every time which is exactly what we would need to do without isYarnInstalled.
    // https://docs.npmjs.com/cli/v7/commands/npm-install
    const { stdout, stderr } = await command("npm ls --json", {
      cwd: workspacePath,
      quiet: true,
    });
    const parsedJson = JSON.parse(stdout);

    // because npm marks packages installed with yarn as "extraneous" we need to check if there are any other problems.
    return parsedJson?.problems.every((problem: string) => problem.startsWith("extraneous"));
  } catch (e) {
    return false;
  }
}

async function isPnpmModulesInstalled(): Promise<boolean> {
  // TODO: add pnpm support
  return false;
}

async function isBunModulesInstalled(): Promise<boolean> {
  // TODO: add bun support
  return false;
}

export async function isNodeModulesInstalled(manager: PackageManagerInfo): Promise<boolean> {
  const workspacePath = manager.workspacePath ?? getAppRootFolder();
  switch (manager.name) {
    case "npm":
      return await isNpmModulesInstalled(workspacePath);
    case "yarn":
      return await isYarnModulesInstalled(workspacePath);
    case "pnpm":
      return await isPnpmModulesInstalled();
    case "bun":
      return await isBunModulesInstalled();
  }
}
