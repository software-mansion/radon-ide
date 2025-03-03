import path from "path";
import fs from "fs";
import { command } from "./subprocess";
import { isWorkspaceRoot } from "./common";
import { Logger } from "../Logger";
import { getLaunchConfiguration } from "./launchConfiguration";
import { requireNoCache } from "./requireNoCache";

export type PackageManagerInfo = {
  name: "npm" | "pnpm" | "yarn" | "bun";
  workspacePath?: string;
};

function isPackageManager(candidate: string): boolean {
  const packageManagers = ["npm", "yarn", "pnpm", "bun"];
  return packageManagers.includes(candidate);
}

async function listFilesSortedByModificationDate(dir: string) {
  const files = await fs.promises.readdir(dir);

  return files
    .map((fileName) => ({
      name: fileName,
      time: fs.statSync(`${dir}/${fileName}`).mtime.getTime(),
    }))
    .sort((a, b) => b.time - a.time)
    .map((file) => file.name);
}

const DEFAULT_PACKAGE_MANAGER = "npm";

export async function resolvePackageManager(
  appRoot: string
): Promise<PackageManagerInfo | undefined> {
  function findWorkspace(appRootPath: string) {
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

  const workspacePath = findWorkspace(appRoot);

  async function findPackageManager(workspace: string) {
    const { packageManager } = getLaunchConfiguration();

    if (packageManager) {
      if (!isPackageManager(packageManager)) {
        Logger.warn(
          `Package manager provided in launch configuration: ${packageManager} is not supported by radon IDE`
        );
        return;
      }
      return packageManager;
    }

    try {
      const manager = requireNoCache(path.join(workspace, "package.json")).packageManager;

      if (manager) {
        // e.g. yarn@3.6.4
        const match = manager.match(/^([a-zA-Z]+)@/);
        return match ? match[1] : DEFAULT_PACKAGE_MANAGER;
      }
    } catch (e) {
      // there might be a problem while reading package.json in which case move to looking
      // for lock files matching package managers in the workspace root
    }

    const lockFiles = new Map(
      Object.entries({
        "yarn.lock": "yarn",
        "package-lock.json": "npm",
        "pnpm-lock.yaml": "pnpm",
        "bun.lock": "bun",
        "bun.lockb": "bun",
      } as const)
    );

    const files = await listFilesSortedByModificationDate(workspace);
    const packageManagerCandidates = [];
    for (const file of files) {
      const manager = lockFiles.get(file);
      if (manager) {
        packageManagerCandidates.push(manager);
      }
    }

    if (packageManagerCandidates.length > 1) {
      Logger.warn(
        "Your workspace contains multiple package manager lock files, it might cause wrong manager to be used"
      );
    }

    if (packageManagerCandidates.length > 0) {
      return packageManagerCandidates[0];
    }

    // when no package manager were detected we default to npm
    return DEFAULT_PACKAGE_MANAGER;
  }

  const name = await findPackageManager(workspacePath ?? appRoot);

  try {
    await command(`${name} --version`);
  } catch (e) {
    Logger.error(`Required package manager: ${name} is not installed`);
    return undefined;
  }

  return { name, workspacePath };
}

async function isNpmModulesInstalled(workspacePath: string): Promise<boolean> {
  try {
    const { stdout } = await command("npm ls --json", {
      cwd: workspacePath,
      quietErrorsOnExit: true,
    });
    const parsedOutput = JSON.parse(stdout);

    if (!parsedOutput || Object.keys(parsedOutput).length === 0) {
      return false;
    }

    return parsedOutput.problems ? false : true;
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
    const { stdout } = await command("npm ls --json", {
      cwd: workspacePath,
      quietErrorsOnExit: true,
    });
    const parsedOutput = JSON.parse(stdout);

    if (!parsedOutput || Object.keys(parsedOutput).length === 0) {
      return false;
    }

    // because npm marks packages installed with yarn as "extraneous" we need to check if there are any other problems.
    return (
      parsedOutput?.problems?.every((problem: string) => problem.startsWith("extraneous")) ?? true
    );
  } catch (e) {
    return false;
  }
}

async function isPnpmModulesInstalled(workspacePath: string): Promise<boolean> {
  try {
    // we use pnpm's ls method for checking dependencies, which returns list of all
    // packages that are installed along with their version info
    const { stdout } = await command("pnpm ls --json", {
      cwd: workspacePath,
      quietErrorsOnExit: true,
    });
    const packages = JSON.parse(stdout);

    if (packages && packages.length === 0) {
      return false;
    }

    // check whether each package has dependencies with a valid versions to prevent issues
    for (const pkg of packages) {
      if (!pkg || !pkg.dependencies || Object.keys(pkg.dependencies).length === 0) {
        return false;
      }

      for (const depInfo of Object.values<{ version: string }>(pkg.dependencies)) {
        if (!depInfo || !depInfo.version) {
          return false;
        }
      }
    }

    return true;
  } catch (e) {
    return false;
  }
}

async function isBunModulesInstalled(): Promise<boolean> {
  // TODO: add bun support
  return false;
}

export async function isNodeModulesInstalled(
  manager: PackageManagerInfo,
  appRoot: string
): Promise<boolean> {
  const workspacePath = manager.workspacePath ?? appRoot;
  switch (manager.name) {
    case "npm":
      return await isNpmModulesInstalled(workspacePath);
    case "yarn":
      return await isYarnModulesInstalled(workspacePath);
    case "pnpm":
      return await isPnpmModulesInstalled(workspacePath);
    case "bun":
      return await isBunModulesInstalled();
  }
}
