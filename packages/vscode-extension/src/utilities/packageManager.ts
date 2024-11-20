import path from "path";
import fs from "fs";
import { command } from "./subprocess";
import { getAppRootFolder } from "./extensionContext";
import { isWorkspaceRoot } from "./common";
import { Logger } from "../Logger";
import { getLaunchConfiguration } from "./launchConfiguration";

export type PackageManagerInfo = {
  name: "npm" | "pnpm" | "yarn" | "bun";
  workspacePath?: string;
};

function isPackageManager(candidate: string): boolean {
  const packageManagers = ["npm", "yarn", "pnpm", "bun"];
  return packageManagers.includes(candidate);
}

export async function resolvePackageManager(): Promise<PackageManagerInfo | undefined> {
  function findWorkspace(appRoot: string) {
    let currentDir = appRoot;
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

  const appRootPath = getAppRootFolder();
  const workspacePath = findWorkspace(appRootPath);

  async function findPackageManager(workspace: string) {
    const { packageManager } = getLaunchConfiguration();

    if (packageManager && isPackageManager(packageManager)) {
      return packageManager;
    }

    try {
      const packageManager = require(path.join(workspace, "package.json")).packageManager;

      if (packageManager) {
        // e.g. yarn@3.6.4
        const match = packageManager.match(/^([a-zA-Z]+)@/);
        return match ? match[1] : "npm";
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
        "bun.lockb": "bun",
      } as const)
    );

    const getDirFilesSortedByModificationDate = async (dir: string) => {
      const files = await fs.promises.readdir(dir);

      return files
        .map((fileName) => ({
          name: fileName,
          time: fs.statSync(`${dir}/${fileName}`).mtime.getTime(),
        }))
        .sort((a, b) => a.time - b.time)
        .map((file) => file.name);
    };

    const files = await getDirFilesSortedByModificationDate(workspace);
    const packageManagerCandidates = [];
    for (const file of files) {
      const packageManager = lockFiles.get(file);
      if (packageManager) {
        packageManagerCandidates.push(packageManager);
      }
    }

    if (packageManagerCandidates.length > 1) {
      Logger.warn(
        "Your workspace contains multiple package manager lock files, it might cause wrong manager to be used"
      );
    }

    if (packageManagerCandidates) {
      return packageManagerCandidates[0];
    }

    // when no package manager were detected we default to npm
    return "npm";
  }

  const name = await findPackageManager(workspacePath ?? appRootPath);

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
    const { stdout } = await command("npm ls --json", {
      cwd: workspacePath,
      quietErrorsOnExit: true,
    });
    const parsedOutput = JSON.parse(stdout);

    // because npm marks packages installed with yarn as "extraneous" we need to check if there are any other problems.
    return (
      parsedOutput?.problems?.every((problem: string) => problem.startsWith("extraneous")) ?? true
    );
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
