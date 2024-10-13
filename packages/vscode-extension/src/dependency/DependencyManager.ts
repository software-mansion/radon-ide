import fs from "fs";
import path from "path";
import { EventEmitter } from "stream";
import { Disposable, OutputChannel } from "vscode";
import semver, { SemVer } from "semver";
import { Logger } from "../Logger";
import { EMULATOR_BINARY } from "../devices/AndroidEmulatorDevice";
import { command, lineReader } from "../utilities/subprocess";
import { extensionContext, getAppRootFolder } from "../utilities/extensionContext";
import { getIosSourceDir } from "../builders/buildIOS";
import { isExpoGoProject } from "../builders/expoGo";
import {
  isNodeModulesInstalled,
  PackageManagerInfo,
  resolvePackageManager,
} from "../utilities/packageManager";
import { getLaunchConfiguration } from "../utilities/launchConfiguration";
import {
  Dependency,
  DependencyListener,
  DependencyManagerInterface,
  DependencyStatus,
  MinSupportedVersion,
} from "../common/DependencyManager";
import { shouldUseExpoCLI } from "../utilities/expoCli";
import { CancelToken } from "../builders/cancelToken";
import { getAndroidSourceDir } from "../builders/buildAndroid";
import { Platform } from "../utilities/platform";

const STALE_PODS = "stalePods";

export class DependencyManager implements Disposable, DependencyManagerInterface {
  // React Native prepares build scripts based on node_modules, we need to reinstall pods if they change
  private stalePods = extensionContext.workspaceState.get<boolean>(STALE_PODS) ?? false;
  private eventEmitter = new EventEmitter();
  private packageManagerInternal: PackageManagerInfo | undefined;

  public dispose() {
    this.eventEmitter.removeAllListeners();
  }

  public async addListener(listener: DependencyListener) {
    this.eventEmitter.addListener("updatedDependencyStatus", listener);
  }

  public async removeListener(listener: DependencyListener) {
    this.eventEmitter.removeListener("updatedDependencyStatus", listener);
  }

  private emitEvent(dependency: Dependency, status: DependencyStatus) {
    this.eventEmitter.emit("updatedDependencyStatus", dependency, status);
  }

  public async runAllDependencyChecks() {
    this.checkAndroidEmulatorBinaryStatus();
    this.checkAndroidDirectoryExits();

    if (Platform.OS === "macos") {
      this.checkXcodebuildCommandStatus();
      this.checkIOSDirectoryExists();
      this.checkPodsCommandStatus();
      this.checkPodsInstallationStatus();
    }

    this.checkNodeCommandStatus();
    this.checkNodeModulesInstallationStatus();

    this.emitEvent("reactNative", {
      status: npmPackageVersionCheck("react-native", MinSupportedVersion.reactNative),
      isOptional: false,
    });

    this.emitEvent("expo", {
      status: npmPackageVersionCheck("expo", MinSupportedVersion.expo),
      isOptional: !shouldUseExpoCLI(),
    });

    this.checkProjectUsesExpoRouter();
    this.checkProjectUsesStorybook();
  }

  public async checkAndroidDirectoryExits() {
    const appRootFolder = getAppRootFolder();
    const androidDirPath = getAndroidSourceDir(appRootFolder);

    const isOptional = !(await projectRequiresNativeBuild());

    try {
      await fs.promises.access(androidDirPath);
      this.emitEvent("android", { status: "installed", isOptional });
      return true;
    } catch (e) {
      this.emitEvent("android", { status: "notInstalled", isOptional });
      return isOptional;
    }
  }

  public async checkIOSDirectoryExists() {
    const appRootFolder = getAppRootFolder();
    const iosDirPath = getIosSourceDir(appRootFolder);

    const isOptional = !(await projectRequiresNativeBuild());
    try {
      await fs.promises.access(iosDirPath);
      this.emitEvent("ios", { status: "installed", isOptional });
      return true;
    } catch (e) {
      this.emitEvent("ios", { status: "notInstalled", isOptional });
      return isOptional;
    }
  }

  public async checkProjectUsesExpoRouter() {
    const dependsOnExpoRouter = appDependsOnExpoRouter();
    const hasExpoRouterInstalled = npmPackageVersionCheck("expo-router");

    this.emitEvent("expoRouter", {
      status: hasExpoRouterInstalled,
      isOptional: !dependsOnExpoRouter,
    });

    return dependsOnExpoRouter;
  }

  public async checkProjectUsesStorybook() {
    const hasStotybookInstalled = npmPackageVersionCheck(
      "@storybook/react-native",
      MinSupportedVersion.storybook
    );
    this.emitEvent("storybook", {
      status: hasStotybookInstalled,
      isOptional: true,
    });
    return hasStotybookInstalled;
  }

  public async installNodeModules(): Promise<boolean> {
    const manager = await this.getPackageManager();
    if (!manager) {
      return false;
    }

    await this.setStalePodsAsync(true);

    this.emitEvent("nodeModules", { status: "installing", isOptional: false });

    // all managers support the `install` command
    await command(`${manager.name} install`, {
      cwd: getAppRootFolder(),
      quietErrorsOnExit: true,
    });

    this.emitEvent("nodeModules", { status: "installed", isOptional: false });

    return true;
  }

  public async installPods(buildOutpuChannel: OutputChannel, cancelToken: CancelToken) {
    const appRootFolder = getAppRootFolder();
    const iosDirPath = getIosSourceDir(appRootFolder);

    if (!iosDirPath) {
      this.emitEvent("pods", { status: "notInstalled", isOptional: false });
      throw new Error("ios directory was not found inside the workspace.");
    }

    try {
      const env = getLaunchConfiguration().env;
      const shouldUseBundle = await this.shouldUseBundleCommand();
      const process = command(shouldUseBundle ? "bundle exec pod install" : "pod install", {
        cwd: iosDirPath,
        env: { ...env, LANG: "en_US.UTF-8" },
      });
      lineReader(process).onLineRead((line) => buildOutpuChannel.appendLine(line));
      await cancelToken.adapt(process);
    } catch (e) {
      Logger.error("Pods not installed", e);
      this.emitEvent("pods", { status: "notInstalled", isOptional: false });
      return;
    }

    await this.setStalePodsAsync(false);

    this.emitEvent("pods", { status: "installed", isOptional: false });
    Logger.debug("Project pods installed");
  }

  private async setStalePodsAsync(stale: boolean) {
    this.stalePods = stale;
    await extensionContext.workspaceState.update(STALE_PODS, stale);
  }

  private async getPackageManager() {
    if (!this.packageManagerInternal) {
      this.packageManagerInternal = await resolvePackageManager();
    }
    return this.packageManagerInternal;
  }

  private async checkAndroidEmulatorBinaryStatus() {
    try {
      await fs.promises.access(EMULATOR_BINARY, fs.constants.X_OK);
      this.emitEvent("androidEmulator", { status: "installed", isOptional: false });
    } catch (e) {
      this.emitEvent("androidEmulator", { status: "notInstalled", isOptional: false });
    }
  }

  private async checkXcodebuildCommandStatus() {
    const isXcodebuildInstalled = await testCommand("xcodebuild -version");
    const isXcrunInstalled = await testCommand("xcrun --version");
    const isSimctlInstalled = await testCommand("xcrun simctl help");

    const isInstalled = isXcodebuildInstalled && isXcrunInstalled && isSimctlInstalled;
    this.emitEvent("xcode", {
      status: isInstalled ? "installed" : "notInstalled",
      isOptional: false,
    });
  }

  private async shouldUseBundleCommand() {
    const gemfile = path.join(getAppRootFolder(), "Gemfile");
    try {
      await fs.promises.access(gemfile);
      return true;
    } catch (e) {
      return false;
    }
  }

  private async checkPodsCommandStatus() {
    const shouldUseBundle = await this.shouldUseBundleCommand();
    const installed = await testCommand(
      shouldUseBundle ? "bundle exec pod --version" : "pod --version"
    );
    this.emitEvent("cocoaPods", {
      status: installed ? "installed" : "notInstalled",
      isOptional: false,
    });
  }

  private async checkNodeCommandStatus() {
    const installed = await testCommand("node -v");
    this.emitEvent("nodejs", {
      status: installed ? "installed" : "notInstalled",
      isOptional: false,
    });
  }

  public async checkNodeModulesInstallationStatus() {
    const packageManager = await resolvePackageManager();
    if (!packageManager) {
      this.emitEvent("nodeModules", { status: "notInstalled", isOptional: false });
      return false;
    }

    const installed = await isNodeModulesInstalled(packageManager);
    this.emitEvent("nodeModules", {
      status: installed ? "installed" : "notInstalled",
      isOptional: false,
    });
    return installed;
  }

  public async checkPodsInstallationStatus() {
    const requiresNativeBuild = await projectRequiresNativeBuild();
    if (!requiresNativeBuild) {
      this.emitEvent("pods", { status: "notInstalled", isOptional: true });
      return true;
    }

    if (requiresNativeBuild && this.stalePods) {
      this.emitEvent("pods", { status: "notInstalled", isOptional: false });
      return false;
    }

    const appRootFolder = getAppRootFolder();
    const iosDirPath = getIosSourceDir(appRootFolder);

    const podfileLockExists = fs.existsSync(path.join(iosDirPath, "Podfile.lock"));
    const podsDirExists = fs.existsSync(path.join(iosDirPath, "Pods"));

    const podsInstallationIsPresent = podfileLockExists && podsDirExists;

    if (!podsInstallationIsPresent) {
      this.emitEvent("pods", { status: "notInstalled", isOptional: false });
      return false;
    }

    // finally, we perform check between Podfile.lock and Pods/Manifest.lock
    // this is what xcode does in Check Pods build phase and is used to determine
    // if pods are up to date

    // run diff command:
    const { failed } = await command("diff Podfile.lock Pods/Manifest.lock", {
      cwd: iosDirPath,
      reject: false,
      quietErrorsOnExit: true,
    });

    this.emitEvent("pods", {
      status: failed ? "notInstalled" : "installed",
      isOptional: false,
    });
    return !failed;
  }
}

async function testCommand(cmd: string) {
  try {
    // We are not checking the stderr here, because some of the CLIs put the warnings there.
    const { failed } = await command(cmd, {
      encoding: "utf8",
      quietErrorsOnExit: true,
      env: { ...process.env, LANG: "en_US.UTF-8" },
    });
    return !failed;
  } catch (_) {
    return false;
  }
}

function requireNoCache(...params: Parameters<typeof require.resolve>) {
  const module = require.resolve(...params);
  delete require.cache[module];
  return require(module);
}

function npmPackageVersionCheck(dependency: string, minVersion?: string | semver.SemVer) {
  try {
    const module = requireNoCache(path.join(dependency, "package.json"), {
      paths: [getAppRootFolder()],
    });

    if (!minVersion) {
      return "installed";
    }

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
  const isXcodebuildInstalled = await testCommand("xcodebuild -version");
  const isXcrunInstalled = await testCommand("xcrun --version");
  const isSimctlInstalled = await testCommand("xcrun simctl help");
  return isXcodebuildInstalled && isXcrunInstalled && isSimctlInstalled;
}

function appDependsOnExpoRouter() {
  // we assume that a expo router based project contain
  // the package "expo-router" in its dependencies or devDependencies
  const appRoot = getAppRootFolder();
  try {
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

async function projectRequiresNativeBuild() {
  const launchConfiguration = getLaunchConfiguration();
  if (launchConfiguration.customBuild || launchConfiguration.eas) {
    return false;
  }

  return !(await isExpoGoProject());
}
