import fs from "fs";
import path from "path";
import { EventEmitter } from "stream";
import { Webview, Disposable } from "vscode";
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
  isPackageManagerAvailable,
  PackageManagerInfo,
  resolvePackageManager,
} from "../utilities/packageManager";
import { getLaunchConfiguration } from "../utilities/launchConfiguration";
import { CancelToken } from "../builders/cancelToken";
import {
  Dependency,
  DependencyListener,
  DependencyStatus,
  InstallationStatus,
  MinSupportedVersion,
} from "../common/DependencyManager";
import { shouldUseExpoCLI } from "../utilities/expoCli";

export class DependencyManager implements Disposable {
  // React Native prepares build scripts based on node_modules, we need to reinstall pods if they change
  private stalePods = true;
  private eventEmitter = new EventEmitter();

  constructor(private readonly webview: Webview) {}

  public dispose() {
    this.eventEmitter.removeAllListeners();
  }

  public addListener(listener: DependencyListener) {
    this.eventEmitter.addListener("dependencyStateChange", listener);
  }

  public removeListener(listener: DependencyListener) {
    this.eventEmitter.removeListener("dependencyStateChange", listener);
  }

  public async isInstalled(
    dependencies: Dependency[]
  ): Promise<Record<Dependency, DependencyStatus>> {
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
            return { status: await this.podsStatus(), isOptional: false }; // TODO(jgonet): make it optional for expo
          case "expo":
            return { status: await this.supportedExpoStatus(), isOptional: !shouldUseExpoCLI() };
          case "expoRouter":
            return { status: await this.expoRouterStatus(), isOptional: !isExpoRouterProject() };
          case "storybook":
            return { status: await this.storybookStatus(), isOptional: true };
        }
      })
    );

    return zipObject(dependencies, statuses) as Record<Dependency, DependencyStatus>;
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

    if (!isPackageManagerAvailable(packageManager)) {
      Logger.error(`Required package manager: ${packageManager} is not installed`);
      throw new Error(`${packageManager} is not installed`);
    }

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

  public async checkNodeModulesInstalled() {
    const packageManager = await resolvePackageManager();

    if (!isPackageManagerAvailable(packageManager)) {
      Logger.error(`Required package manager: ${packageManager} is not installed`);
      throw new Error(`${packageManager} is not installed`);
    }

    const installed = await isNodeModulesInstalled(packageManager);

    this.webview.postMessage({
      command: "isNodeModulesInstalled",
      data: {
        installed,
        info: "Whether node modules are installed",
        error: undefined,
      },
    });
    Logger.debug("Node Modules installed:", installed);
    return { installed, packageManager };
  }
  public async installNodeModules(manager: PackageManagerInfo): Promise<void> {
    this.stalePods = true;

    this.webview.postMessage({
      command: "installingNodeModules",
    });

    const workspacePath = getAppRootFolder();
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

    this.webview.postMessage({
      command: "isNodeModulesInstalled",
      data: {
        installed: true,
        info: "Whether node modules are installed",
        error: undefined,
      },
    });
  }

  public async checkCocoaPodsInstalled() {
    const installed = await checkIfCLIInstalled("pod --version", {
      env: { LANG: "en_US.UTF-8" },
    });
    const errorMessage =
      "CocoaPods was not found. Make sure to [install CocoaPods](https://guides.cocoapods.org/using/getting-started.html).";
    this.webview.postMessage({
      command: "isCocoaPodsInstalled",
      data: {
        installed,
        info: "Used for installing iOS dependencies.",
        error: installed ? undefined : errorMessage,
      },
    });
    Logger.debug("CocoaPods installed:", installed);
    return installed;
  }

  private async checkIosDependenciesInstalled() {
    if (await isExpoGoProject()) {
      // for Expo Go projects, we never return an error here because Pods are never needed
      return true;
    }

    if (this.stalePods) {
      return false;
    }

    const iosDirPath = getIosSourceDir(getAppRootFolder());

    Logger.debug(`Check pods in ${iosDirPath} ${getAppRootFolder()}`);
    if (!iosDirPath) {
      return false;
    }

    const podfileLockExists = fs.existsSync(path.join(iosDirPath, "Podfile.lock"));
    const podsDirExists = fs.existsSync(path.join(iosDirPath, "Pods"));

    return podfileLockExists && podsDirExists;
  }

  public async checkPodsInstalled() {
    const installed = await this.checkIosDependenciesInstalled();

    this.webview.postMessage({
      command: "isPodsInstalled",
      data: {
        installed,
        info: "Whether iOS dependencies are installed.",
        error: undefined,
      },
    });
    Logger.debug("Project pods installed:", installed);
    return installed;
  }

  public async checkExpoRouterInstalled() {
    const status = checkMinDependencyVersionInstalled(
      "expo-router",
      MinSupportedVersion.expoRouter
    );

    const installed = status === "installed";

    this.webview.postMessage({
      command: "isExpoRouterInstalled",
      data: {
        installed,
        info: "Whether supported version of Expo Router is installed.",
        error: undefined,
        isOptional: !isExpoRouterProject(),
      },
    });
    Logger.debug(`Minimum Expo version installed:`, installed);
    return installed;
  }

  public async checkStorybookInstalled() {
    const status = checkMinDependencyVersionInstalled(
      "@storybook/react-native",
      MinSupportedVersion.storybook
    );
    const installed = status === "installed";

    this.webview.postMessage({
      command: "isStorybookInstalled",
      data: {
        installed,
        info: "Whether Storybook is installed.",
        error: undefined,
        isOptional: true,
      },
    });
    Logger.debug("Storybook installed:", installed);
    return installed;
  }

  public async installPods(
    appRootFolder: string,
    forceCleanBuild: boolean,
    cancelToken: CancelToken
  ) {
    const iosDirPath = getIosSourceDir(appRootFolder);

    if (!iosDirPath) {
      this.webview.postMessage({
        command: "isPodsInstalled",
        data: {
          installed: false,
          info: "Whether iOS dependencies are installed.",
          error: "iOS directory does not exist",
        },
      });
      throw new Error(`ios directory was not found inside the workspace.`);
    }

    const commandInIosDir = (args: string) => {
      return command(args, {
        cwd: iosDirPath,
        env: {
          ...getLaunchConfiguration().env,
          LANG: "en_US.UTF-8",
        },
      });
    };

    try {
      if (forceCleanBuild) {
        await cancelToken.adapt(commandInIosDir("pod deintegrate"));
      }

      await cancelToken.adapt(commandInIosDir("pod install"));
    } catch (e) {
      Logger.error("Pods not installed", e);
      this.webview.postMessage({
        command: "isPodsInstalled",
        data: {
          installed: false,
          info: "Whether iOS dependencies are installed.",
          error: "Unable to install pods",
        },
      });
      return;
    }

    this.stalePods = false;

    this.webview.postMessage({
      command: "isPodsInstalled",
      data: {
        installed: true,
        info: "Whether iOS dependencies are installed.",
        error: undefined,
      },
    });
    Logger.debug("Project pods installed");
  }
}

export async function checkIfCLIInstalled(cmd: string, options: Record<string, unknown> = {}) {
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

export function checkMinDependencyVersionInstalled(
  dependency: string,
  minVersion: string | semver.SemVer
): InstallationStatus {
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

export function isExpoRouterProject() {
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
