import fs from "fs";
import path from "path";
import { Webview, Disposable } from "vscode";
import { coerce, gte } from "semver";
import { Logger } from "../Logger";
import { EMULATOR_BINARY } from "../devices/AndroidEmulatorDevice";
import { command } from "../utilities/subprocess";
import { getAppRootFolder } from "../utilities/extensionContext";
import { getIosSourceDir } from "../builders/buildIOS";
import { isExpoGoProject } from "../builders/expoGo";
import { shouldUseExpoCLI } from "../utilities/expoCli";
import {
  isNodeModulesInstalled,
  isPackageManagerAvailable,
  PackageManagerInfo,
  resolvePackageManager,
} from "../utilities/packageManager";
import { getLaunchConfiguration } from "../utilities/launchConfiguration";
import { CancelToken } from "../builders/cancelToken";
import { Dependency, DependencyState } from "../common/DependencyManager";

const MIN_REACT_NATIVE_VERSION_SUPPORTED = "0.71.0";
const MIN_EXPO_SDK_VERSION_SUPPORTED = "49.0.0";
const MIN_STORYBOOK_VERSION_SUPPORTED = "5.2.0";
const MIN_EXPO_ROUTER_VERSION_SUPPORTED = "0.0.0";

export class DependencyManager implements Disposable {
  private disposables: Disposable[] = [];
  // React Native prepares build scripts based on node_modules, we need to reinstall pods if they change
  private stalePods = true;

  constructor(private readonly webview: Webview) {}

  public getDependencyStatus(dependency: Dependency): Promise<DependencyState> {
    switch (dependency) {
      case "androidEmulator":
        return this.isAndroidEmulatorInstalled();
      case "xcode":
        return this.isXcodeInstalled();
      case "cocoaPods":
        return this.isCocoaPodsInstalled();
      case "nodejs":
        return this.isNodeInstalled();
      case "nodeModules":
        return this.isNodeModulesInstalled();
      case "reactNative":
        return this.isSupportedReactNativeInstalled();
      case "pods":
        return this.isPodsInstalled();
      case "expo":
        return this.isSupportedExpoInstalled();
      case "expoRouter":
        return this.isExpoRouterInstalled();
      case "storybook":
        return this.isStorybookInstalled();
    }
  }

  private async isAndroidEmulatorInstalled() {
    const installed = fs.existsSync(EMULATOR_BINARY);
    const errorMessage =
      "Android Emulator was not found. Make sure to [install Android Emulator](https://developer.android.com/studio/run/managing-avds).";

    return {
      installed,
      info: "Used for running Android apps.",
      error: installed ? undefined : errorMessage,
    };
  }

  private async isXcodeInstalled() {
    const isXcodebuildInstalled = await checkIfCLIInstalled("xcodebuild -version");
    const isXcrunInstalled = await checkIfCLIInstalled("xcrun --version");
    const isSimctlInstalled = await checkIfCLIInstalled("xcrun simctl help");
    const installed = isXcodebuildInstalled && isXcrunInstalled && isSimctlInstalled;

    const errorMessage =
      "Xcode was not found. If you are using alternative Xcode version you can find out more in troubleshooting section of our documentation. Otherwise, [Install Xcode from the Mac App Store](https://apps.apple.com/us/app/xcode/id497799835?mt=12) and have Xcode Command Line Tools enabled.";
    return {
      installed,
      info: "Used for building and running iOS apps.",
      error: installed ? undefined : errorMessage,
    };
  }

  private async isCocoaPodsInstalled() {
    const installed = await checkIfCLIInstalled("pod --version", {
      env: { LANG: "en_US.UTF-8" },
    });
    const errorMessage =
      "CocoaPods was not found. Make sure to [install CocoaPods](https://guides.cocoapods.org/using/getting-started.html).";

    return {
      installed,
      info: "Used for installing iOS dependencies.",
      error: installed ? undefined : errorMessage,
    };
  }

  private async isNodeInstalled() {
    const installed = await checkIfCLIInstalled("node -v");
    const errorMessage =
      "Node.js was not found. Make sure to [install Node.js](https://nodejs.org/en).";

    return {
      installed,
      info: "Used for running scripts and getting dependencies.",
      error: installed ? undefined : errorMessage,
    };
  }

  private async isNodeModulesInstalled() {
    const packageManager = await resolvePackageManager();

    if (!isPackageManagerAvailable(packageManager)) {
      Logger.error(`Required package manager: ${packageManager} is not installed`);
      throw new Error(`${packageManager} is not installed`);
    }

    const installed = await isNodeModulesInstalled(packageManager);

    return {
      installed,
      info: "Whether node modules are installed",
      error: undefined,
    };
  }

  private async isSupportedReactNativeInstalled() {
    const status = checkMinDependencyVersionInstalled(
      "react-native",
      MIN_REACT_NATIVE_VERSION_SUPPORTED
    );

    const error = {
      installed: undefined,
      not_installed: "React Native is not installed.",
      not_supported: `Installed version of React Native does not match the minimum requirement: ${MIN_REACT_NATIVE_VERSION_SUPPORTED}.`,
    }[status];

    const installed = status === "installed";

    return {
      installed,
      info: "Whether supported version of React Native is installed.",
      error,
    };
  }

  private async isPodsInstalled() {
    const installed = await this.checkIosDependenciesInstalled();

    return {
      installed,
      info: "Whether iOS dependencies are installed.",
      error: undefined,
    };
  }

  private async isSupportedExpoInstalled() {
    const status = checkMinDependencyVersionInstalled("expo", MIN_EXPO_SDK_VERSION_SUPPORTED);

    const error = {
      installed: undefined,
      not_installed: "Expo is not installed.",
      not_supported: `Installed version of Expo does not match the minimum requirement: ${MIN_EXPO_SDK_VERSION_SUPPORTED}.`,
    }[status];

    const installed = status === "installed";

    return {
      installed,
      info: "Whether supported version of Expo SDK is installed.",
      error,
      isOptional: !shouldUseExpoCLI(),
    };
  }

  private async isExpoRouterInstalled() {
    const status = checkMinDependencyVersionInstalled(
      "expo-router",
      MIN_EXPO_ROUTER_VERSION_SUPPORTED
    );

    const installed = status === "installed";

    return {
      installed,
      info: "Whether supported version of Expo Router is installed.",
      error: undefined,
      isOptional: !isExpoRouterProject(),
    };
  }

  private async isStorybookInstalled() {
    const status = checkMinDependencyVersionInstalled(
      "@storybook/react-native",
      MIN_STORYBOOK_VERSION_SUPPORTED
    );
    const installed = status === "installed";

    return {
      installed,
      info: "Whether Storybook is installed.",
      error: undefined,
      isOptional: true,
    };
  }

  public dispose() {
    // Dispose of all disposables (i.e. commands) for the current webview panel
    while (this.disposables.length) {
      const disposable = this.disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
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
      MIN_EXPO_ROUTER_VERSION_SUPPORTED
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
      MIN_STORYBOOK_VERSION_SUPPORTED
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

export function checkMinDependencyVersionInstalled(dependency: string, minVersion: string) {
  const message = `Check ${dependency} module version.`;

  try {
    const module = requireNoCache(path.join(dependency, "package.json"), {
      paths: [getAppRootFolder()],
    });
    const dependencyVersion = coerce(module.version);
    const minDependencyVersion = coerce(minVersion)!;

    Logger.debug(message, `Version found: ${dependencyVersion}. Minimum version: ${minVersion}`);

    const matches = dependencyVersion ? gte(dependencyVersion, minDependencyVersion) : false;
    return matches ? "installed" : "not_supported";
  } catch (error) {
    Logger.debug(message, "Module not found.");
    return "not_installed";
  }
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
    const hasExpoRouter =
      Object.keys(packageJson.dependencies).some((dependency) => dependency === "expo-router") ||
      Object.keys(packageJson.devDependencies).some((dependency) => dependency === "expo-router");
    return hasExpoRouter;
  } catch (e) {
    return false;
  }
}
