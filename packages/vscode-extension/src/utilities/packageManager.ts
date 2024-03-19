import * as PackageManager from "@expo/package-manager";
import { exec } from "./subprocess";
import { promises as fs } from "fs";
import { resolve } from "path";
import { getAppRootFolder } from "./extensionContext";

export type PackageManagerName = "npm" | "pnpm" | "yarn" | "bun";

async function pathExists(p: string) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

export async function resolvePackageManager(): Promise<PackageManagerName> {
  const workspacePath = getAppRootFolder();
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

    return "npm";
  });
}

export function isPackageManagerAvailable(manager: PackageManagerName): boolean {
  try {
    exec(`${manager} --version`);
    return true;
  } catch {}
  return false;
}

export async function installNodeModulesAsync(packageManager: PackageManagerName) {
  const options = { cwd: getAppRootFolder() };
  if (packageManager === "yarn") {
    await new PackageManager.YarnPackageManager(options).installAsync();
  } else if (packageManager === "pnpm") {
    await new PackageManager.PnpmPackageManager(options).installAsync();
  } else if (packageManager === "bun") {
    await new PackageManager.BunPackageManager(options).installAsync();
  } else {
    await new PackageManager.NpmPackageManager(options).installAsync();
  }
}
