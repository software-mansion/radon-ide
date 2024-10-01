import fs from "fs";
import path from "path";
import { EventEmitter } from "stream";
import { Disposable } from "vscode";
import semver, { SemVer } from "semver";
import zipObject from "lodash/zipObject";
import { Logger } from "../Logger";
import { EMULATOR_BINARY } from "../devices/AndroidEmulatorDevice";
import { command } from "../utilities/subprocess";
import { getAppRootFolder } from "../utilities/extensionContext";
import { getIosSourceDir } from "../builders/buildIOS";
import { isExpoGoProject } from "../builders/expoGo";
import {
  isNodeModulesInstalled,
  PackageManagerInfo,
  resolvePackageManager,
} from "../utilities/packageManager";
import { getLaunchConfiguration } from "../utilities/launchConfiguration";
import {
  DependenciesStatus,
  Dependency,
  DependencyListener,
  DependencyManagerInterface,
  DependencyStatus,
  InstallationStatus,
  InstallPodsOptions,
  MinSupportedVersion,
} from "../common/DependencyManager";
import { shouldUseExpoCLI } from "../utilities/expoCli";

export class DependencyManager implements Disposable, DependencyManagerInterface {
  // React Native prepares build scripts based on node_modules, we need to reinstall pods if they change
  private stalePods = true;
  private eventEmitter = new EventEmitter();
  private packageManagerInternal: PackageManagerInfo | undefined;

  public dispose() {
    this.eventEmitter.removeAllListeners();
  }

  public async addListener(listener: DependencyListener) {
    this.eventEmitter.addListener("updatedDependencyInstallationStatus", listener);
  }

  public async removeListener(listener: DependencyListener) {
    this.eventEmitter.removeListener("updatedDependencyInstallationStatus", listener);
  }

  private emitEvent(dependency: Dependency, status: InstallationStatus) {
    this.eventEmitter.emit("updatedDependencyInstallationStatus", dependency, status);
  }

  public async getStatus(dependencies: Dependency[]): Promise<DependenciesStatus> {
    const statuses = await Promise.all(
      dependencies.map(async (dependency): Promise<DependencyStatus> => {
        switch (dependency) {
          case "androidEmulator":
            return { status: await this.androidEmulatorStatus(), isOptional: false };
          case "xcode":
            return { status: await this.xcodeStatus(), isOptional: false };
          case "cocoaPods":
            return { status: await this.cocoapodsStatus(), isOptional: false };
          case "nodejs":
            return { status: await this.nodeStatus(), isOptional: false };
          case "nodeModules":
            return { status: await this.nodeModulesStatus(), isOptional: false };
          case "reactNative":
            return { status: await this.supportedReactNativeStatus(), isOptional: false };
          case "pods":
            return { status: await this.podsStatus(), isOptional: !isExpoGoProject() };
          case "expo":
            return { status: await this.supportedExpoStatus(), isOptional: !shouldUseExpoCLI() };
          case "expoRouter":
            return { status: await this.expoRouterStatus(), isOptional: !isExpoRouterProject() };
          case "storybook":
            return { status: await this.storybookStatus(), isOptional: true };
        }
      })
    );

    return zipObject(dependencies, statuses) as DependenciesStatus;
  }

  public async isInstalled(dependency: Dependency) {
    const status = await this.getStatus([dependency]);
    return status[dependency].status === "installed";
  }

  private async androidEmulatorStatus() {
    if (fs.existsSync(EMULATOR_BINARY)) {
      return "installed";
    }
    return "notInstalled";
  }

  private async xcodeStatus() {
    const isXcodebuildInstalled = await checkIfCLIInstalled("xcodebuild -version");
    const isXcrunInstalled = await checkIfCLIInstalled("xcrun --version");
    const isSimctlInstalled = await checkIfCLIInstalled("xcrun simctl help");

    if (isXcodebuildInstalled && isXcrunInstalled && isSimctlInstalled) {
      return "installed";
    }
    return "notInstalled";
  }

  private async cocoapodsStatus() {
    const installed = await checkIfCLIInstalled("pod --version", {
      env: { LANG: "en_US.UTF-8" },
    });

    if (installed) {
      return "installed";
    }
    return "notInstalled";
  }

  private async nodeStatus() {
    const installed = await checkIfCLIInstalled("node -v");
    if (installed) {
      return "installed";
    }
    return "notInstalled";
  }

  private async nodeModulesStatus() {
    const packageManager = await resolvePackageManager();

    const installed = await isNodeModulesInstalled(packageManager);
    if (installed) {
      return "installed";
    }
    return "notInstalled";
  }

  private async supportedReactNativeStatus() {
    return checkMinDependencyVersionInstalled("react-native", MinSupportedVersion.reactNative);
  }

  private async podsStatus() {
    const installed = await this.checkIosDependenciesInstalled();
    if (installed) {
      return "installed";
    }
    return "notInstalled";
  }

  private async supportedExpoStatus() {
    return checkMinDependencyVersionInstalled("expo", MinSupportedVersion.expo);
  }

  private async expoRouterStatus() {
    return checkMinDependencyVersionInstalled("expo-router", MinSupportedVersion.expoRouter);
  }

  private async storybookStatus() {
    return checkMinDependencyVersionInstalled(
      "@storybook/react-native",
      MinSupportedVersion.storybook
    );
  }

  private async getPackageManager() {
    if (!this.packageManagerInternal) {
      this.packageManagerInternal = await resolvePackageManager();
    }
    return this.packageManagerInternal;
  }

  public async installNodeModules(): Promise<void> {
    const manager = await this.getPackageManager();
    const workspacePath = getAppRootFolder();
    this.stalePods = true;

    this.emitEvent("nodeModules", "installing");

    let installationCommand;
    switch (manager.name) {
      case "npm":
        installationCommand = "npm install";
        break;
      case "yarn":
        installationCommand = "yarn install";
        break;
      case "pnpm":
        installationCommand = "pnpm install";
        break;
      case "bun":
        installationCommand = "bun install";
        break;
    }

    await command(installationCommand, {
      cwd: workspacePath,
      quietErrorsOnExit: true,
    });

    this.emitEvent("nodeModules", "installed");
  }

  private async checkIosDependenciesInstalled() {
    if (await isExpoGoProject()) {
      // Expo Go projects don't need pods
      return true;
    }

    if (this.stalePods) {
      return false;
    }

    const appRootFolder = getAppRootFolder();
    const iosDirPath = getIosSourceDir(appRootFolder);

    Logger.debug(`Check pods in ${iosDirPath}`);
    if (!iosDirPath) {
      return false;
    }

    const podfileLockExists = fs.existsSync(path.join(iosDirPath, "Podfile.lock"));
    const podsDirExists = fs.existsSync(path.join(iosDirPath, "Pods"));

    return podfileLockExists && podsDirExists;
  }

  public async installPods(options: InstallPodsOptions) {
    const { forceCleanBuild, cancelToken } = options;
    const appRootFolder = getAppRootFolder();
    const iosDirPath = getIosSourceDir(appRootFolder);

    if (!iosDirPath) {
      this.emitEvent("pods", "notInstalled");
      throw new Error("ios directory was not found inside the workspace.");
    }

    const commandInIosDir = (args: string) => {
      const env = getLaunchConfiguration().env;
      return command(args, {
        cwd: iosDirPath,
        env: { ...env, LANG: "en_US.UTF-8" },
      });
    };

    try {
      if (forceCleanBuild) {
        await cancelToken.adapt(commandInIosDir("pod deintegrate"));
      }

      await cancelToken.adapt(commandInIosDir("pod install"));
    } catch (e) {
      Logger.error("Pods not installed", e);
      this.emitEvent("pods", "notInstalled");
      return;
    }

    this.stalePods = false;

    this.emitEvent("pods", "installed");
    Logger.debug("Project pods installed");
  }
}

async function checkIfCLIInstalled(cmd: string, options: Record<string, unknown> = {}) {
  try {
    // We are not checking the stderr here, because some of the CLIs put the warnings there.
    const { stdout } = await command(cmd, {
      encoding: "utf8",
      quietErrorsOnExit: true,
      ...options,
    });
    const result = stdout.length > 0;
    Logger.debug(`CLI: ${cmd} ${result ? "" : "not"} installed `);
    return result;
  } catch (_) {
    Logger.debug(`CLI: ${cmd} not installed `);
    return false;
  }
}

function requireNoCache(...params: Parameters<typeof require.resolve>) {
  const module = require.resolve(...params);
  delete require.cache[module];
  return require(module);
}

function checkMinDependencyVersionInstalled(
  dependency: string,
  minVersion: string | semver.SemVer
) {
  try {
    const module = requireNoCache(path.join(dependency, "package.json"), {
      paths: [getAppRootFolder()],
    });
    const version = semver.coerce(module.version);
    minVersion = new SemVer(minVersion);

    const isSupported = version ? semver.gte(version, minVersion) : false;
    // if not supported, we treat it as not installed
    if (isSupported) {
      return "installed";
    }
  } catch (_error) {
    // ignore if not installed
  }
  return "notInstalled";
}

export async function checkXcodeExists() {
  const isXcodebuildInstalled = await checkIfCLIInstalled("xcodebuild -version");
  const isXcrunInstalled = await checkIfCLIInstalled("xcrun --version");
  const isSimctlInstalled = await checkIfCLIInstalled("xcrun simctl help");
  return isXcodebuildInstalled && isXcrunInstalled && isSimctlInstalled;
}

function isExpoRouterProject() {
  // we assume that a expo router based project contain
  // the package "expo-router" in its dependencies or devDependencies
  try {
    const appRoot = getAppRootFolder();
    const packageJson = requireNoCache(path.join(appRoot, "package.json"));
    const allDependencies = [
      ...Object.keys(packageJson.dependencies),
      ...Object.keys(packageJson.devDependencies),
    ];
    return allDependencies.includes("expo-router");
  } catch (e) {
    return false;
  }
}
