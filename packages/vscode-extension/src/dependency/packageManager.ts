import path from "path";
import fs from "fs";
import { command } from "../utilities/subprocess";
import { isWorkspaceRoot } from "../utilities/common";
import { Logger } from "../Logger";
import { requireNoCache } from "../utilities/requireNoCache";
import { ResolvedLaunchConfig } from "../project/ApplicationContext";
import { CancelToken } from "../utilities/cancelToken";
import { Disposable, OutputChannel } from "vscode";

export type PackageManagerInfo = {
  name: "npm" | "pnpm" | "yarn" | "bun";
  workspacePath?: string;
};

export class PackageManager implements Disposable {
  private nodeModulesInstallationProcess:
    | {
        nodeModulesPromise: Promise<void>;
        cancelToken: CancelToken;
      }
    | undefined;
  constructor(private readonly launchConfiguration: ResolvedLaunchConfig) {}

  public async isPackageManagerInstalled() {
    // the resolvePackageManager function in getPackageManager checks
    // if a package manager is installed and otherwise returns undefined
    return Boolean(await resolvePackageManager(this.launchConfiguration));
  }

  /**
   * Installs node_modules project within the workspace.
   *
   * This method ensures that only one node_modules installation process runs at a time by cancelling any ongoing installation.
   *
   * @param outputChannel - The channel to which installation output will be appended.
   * @param cancelToken - A token that can be used to cancel the node_modules installation process.
   */
  public async installNodeModules(
    outputChannel: OutputChannel,
    cancelToken: CancelToken
  ): Promise<void> {
    if (this.nodeModulesInstallationProcess) {
      this.nodeModulesInstallationProcess.cancelToken.cancel();
    }

    // we create a new cancel token to avoid cancelling the calling process when the node_modules installation is cancelled
    const cancelNodeModulesInstallToken = new CancelToken();
    cancelToken.onCancel(() => cancelNodeModulesInstallToken.cancel());
    const { promise, resolve, reject } = Promise.withResolvers<void>();
    this.nodeModulesInstallationProcess = {
      nodeModulesPromise: promise,
      cancelToken: cancelNodeModulesInstallToken,
    };
    const appRoot = this.launchConfiguration.absoluteAppRoot;
    const packageManager = await resolvePackageManager(this.launchConfiguration);
    if (!packageManager) {
      // this should be unreachable, but we handle it just in case.
      return reject(
        "No package manager found. Please install npm, yarn, pnpm or bun to manage your project dependencies."
      );
    }

    try {
      // all package managers support the `install` command
      await cancelToken.adapt(
        command(`${packageManager.name} install`, {
          cwd: packageManager.workspacePath ?? appRoot,
          quietErrorsOnExit: true,
        })
      );
      resolve();
    } catch (e) {
      Logger.error("Failed to install node modules", e);
      reject("Failed to install node modules. Check the logs for details.");
    } finally {
      this.nodeModulesInstallationProcess = undefined;
    }

    return promise;
  }

  public async areNodeModulesInstalled(): Promise<boolean> {
    const appRoot = this.launchConfiguration.absoluteAppRoot;
    const packageManager = (await resolvePackageManager(this.launchConfiguration)) ?? {
      name: "npm",
    };

    return isNodeModulesInstalled(packageManager, appRoot);
  }

  dispose() {
    this.nodeModulesInstallationProcess?.cancelToken.cancel();
    this.nodeModulesInstallationProcess = undefined;
  }
}

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
  launchConfiguration: ResolvedLaunchConfig
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

  const workspacePath = findWorkspace(launchConfiguration.absoluteAppRoot);

  async function findPackageManager(workspace: string) {
    const { packageManager } = launchConfiguration;

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

  const name = await findPackageManager(workspacePath ?? launchConfiguration.absoluteAppRoot);

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
    // check whether each package has dependencies
    for (const pkg of packages) {
      if (
        !pkg ||
        (!pkg.dependencies && !pkg.unsavedDependencies) ||
        (Object.keys(pkg.dependencies ?? {}).length === 0 &&
          Object.keys(pkg.unsavedDependencies ?? {}).length === 0)
      ) {
        return false;
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
