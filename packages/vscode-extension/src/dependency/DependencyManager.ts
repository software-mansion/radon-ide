import fs from "fs";
import path from "path";
import { EventEmitter } from "stream";
import { Disposable, OutputChannel } from "vscode";
import semver, { SemVer } from "semver";
import { Logger } from "../Logger";
import { EMULATOR_BINARY } from "../devices/AndroidEmulatorDevice";
import { command, exec, lineReader } from "../utilities/subprocess";
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
import { requireNoCache } from "../utilities/requireNoCache";
import { getTelemetryReporter } from "../utilities/telemetry";
import { DevicePlatform } from "../common/DeviceManager";
import { isEasCliInstalled } from "../builders/easCommand";
import { getMinimumSupportedNodeVersion } from "../utilities/getMinimumSupportedNodeVersion";

export class DependencyManager implements Disposable, DependencyManagerInterface {
  constructor(private readonly appRootFolder: string) {}
  // React Native prepares build scripts based on node_modules, we need to reinstall pods if they change
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
    const appRoot = this.appRootFolder;
    this.checkAndroidEmulatorBinaryStatus();
    this.checkAndroidDirectoryExits();

    if (Platform.OS === "macos") {
      this.checkXcodebuildCommandStatus();
      this.checkIOSDirectoryExists();
      this.checkPodsCommandStatus();
      this.checkPodsInstallationStatus();
    }

    this.checkNodeCommandStatus();
    this.checkPackageManagerInstallationStatus();
    this.checkNodeModulesInstallationStatus();

    this.emitEvent("reactNative", {
      status: npmPackageVersionCheck("react-native", appRoot, MinSupportedVersion.reactNative),
      isOptional: false,
    });

    this.emitEvent("expo", {
      status: npmPackageVersionCheck("expo", appRoot, MinSupportedVersion.expo),
      isOptional: !shouldUseExpoCLI(appRoot),
    });

    this.checkProjectUsesExpoRouter();
    this.checkProjectUsesStorybook();
    this.checkEasCliInstallationStatus();
  }

  public async validateNodeVersion(appRoot: string) {
    const { stdout: nodeVersion } = await exec("node", ["-v"]);
    const minimumNodeVersion = getMinimumSupportedNodeVersion(appRoot);
    const isMinimumNodeVersion = semver.satisfies(nodeVersion, minimumNodeVersion);
    this.emitEvent("nodejs", {
      status: isMinimumNodeVersion ? "installed" : "notInstalled",
      isOptional: false,
    });
  }

  public async checkAndroidDirectoryExits() {
    const appRoot = this.appRootFolder;
    const androidDirPath = getAndroidSourceDir(appRoot);

    const isOptional = !(await projectRequiresNativeBuild(appRoot));

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
    const appRoot = this.appRootFolder;
    const iosDirPath = getIosSourceDir(appRoot);

    const isOptional = !(await projectRequiresNativeBuild(appRoot));
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
    const appRoot = this.appRootFolder;
    const dependsOnExpoRouter = appDependsOnExpoRouter(appRoot);
    const hasExpoRouterInstalled = npmPackageVersionCheck("expo-router", appRoot);

    this.emitEvent("expoRouter", {
      status: hasExpoRouterInstalled,
      isOptional: !dependsOnExpoRouter,
    });

    return dependsOnExpoRouter;
  }

  public async checkProjectUsesStorybook() {
    const appRoot = this.appRootFolder;
    const hasStotybookInstalled = npmPackageVersionCheck(
      "@storybook/react-native",

      appRoot,
      MinSupportedVersion.storybook
    );
    this.emitEvent("storybook", {
      status: hasStotybookInstalled,
      isOptional: true,
    });
    return hasStotybookInstalled;
  }

  public async installNodeModules(): Promise<boolean> {
    const appRoot = this.appRootFolder;
    const packageManager = await this.getPackageManager(appRoot);
    if (!packageManager) {
      return false;
    }

    this.emitEvent("nodeModules", { status: "installing", isOptional: false });

    // all package managers support the `install` command
    await command(`${packageManager.name} install`, {
      cwd: packageManager.workspacePath ?? appRoot,
      quietErrorsOnExit: true,
    });

    this.emitEvent("nodeModules", { status: "installed", isOptional: false });

    return true;
  }

  public async installPods(buildOutputChannel: OutputChannel, cancelToken: CancelToken) {
    const appRoot = this.appRootFolder;
    const iosDirPath = getIosSourceDir(appRoot);

    if (!iosDirPath) {
      this.emitEvent("pods", { status: "notInstalled", isOptional: false });
      throw new Error("ios directory was not found inside the workspace.");
    }

    try {
      const env = getLaunchConfiguration().env;
      const shouldUseBundle = await this.shouldUseBundleCommand();
      const process = command(
        shouldUseBundle ? "bundle install && bundle exec pod install" : "pod install",
        {
          shell: shouldUseBundle, // when using bundle, we need shell to run multiple commands
          cwd: iosDirPath,
          env: { ...env, LANG: "en_US.UTF-8" },
        }
      );
      lineReader(process).onLineRead((line) => buildOutputChannel.appendLine(line));
      await cancelToken.adapt(process);
    } catch (e) {
      Logger.error("Pods not installed", e);
      getTelemetryReporter().sendTelemetryEvent("build:pod-install-failed", {
        platform: DevicePlatform.IOS,
      });
      this.emitEvent("pods", { status: "notInstalled", isOptional: false });
      return;
    }

    this.emitEvent("pods", { status: "installed", isOptional: false });
    Logger.debug("Project pods installed");
  }

  private async getPackageManager(appRoot: string) {
    if (!this.packageManagerInternal) {
      this.packageManagerInternal = await resolvePackageManager(appRoot);
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
    const appRoot = this.appRootFolder;
    const gemfile = path.join(appRoot, "Gemfile");
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
    const appRoot = this.appRootFolder;
    this.emitEvent("cocoaPods", {
      status: installed ? "installed" : "notInstalled",
      isOptional: !(await projectRequiresNativeBuild(appRoot)),
    });
  }

  private async checkNodeCommandStatus() {
    const installed = await testCommand("node -v");
    this.emitEvent("nodejs", {
      status: installed ? "installed" : "notInstalled",
      isOptional: false,
    });
  }

  private async checkPackageManagerInstallationStatus() {
    const appRoot = this.appRootFolder;

    // the resolvePackageManager function in getPackageManager checks
    // if a package manager is installed and otherwise returns undefined
    const packageManager = await this.getPackageManager(appRoot);
    this.emitEvent("packageManager", {
      status: packageManager ? "installed" : "notInstalled",
      isOptional: false,
      details: packageManager?.name,
    });
    return packageManager;
  }

  public async checkNodeModulesInstallationStatus() {
    const appRoot = this.appRootFolder;
    const packageManager = await this.getPackageManager(appRoot);
    if (!packageManager) {
      this.emitEvent("nodeModules", { status: "notInstalled", isOptional: false });
      return false;
    }

    const installed = await isNodeModulesInstalled(packageManager, appRoot);
    this.emitEvent("nodeModules", {
      status: installed ? "installed" : "notInstalled",
      isOptional: false,
    });
    return installed;
  }

  public async checkPodsInstallationStatus() {
    const appRoot = this.appRootFolder;
    const requiresNativeBuild = await projectRequiresNativeBuild(appRoot);
    if (!requiresNativeBuild) {
      this.emitEvent("pods", { status: "notInstalled", isOptional: true });
      return true;
    }

    const iosDirPath = getIosSourceDir(appRoot);

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

  public async checkEasCliInstallationStatus() {
    const appRoot = this.appRootFolder;
    const installed = await isEasCliInstalled(appRoot);
    this.emitEvent("easCli", {
      status: installed ? "installed" : "notInstalled",
      isOptional: true,
    });
    return;
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

function npmPackageVersionCheck(
  dependency: string,
  appRoot: string,
  minVersion?: string | semver.SemVer
) {
  try {
    const module = requireNoCache(path.join(dependency, "package.json"), {
      paths: [appRoot],
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

function appDependsOnExpoRouter(appRoot: string) {
  // we assume that a expo router based project contain
  // the package "expo-router" in its dependencies or devDependencies
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

/**
 * Returns true if the project needs to be built by the IDE using the normall
 * platform-specific tooling (xcodebuild or gralde). This is needed for us to
 * be able to tell whether the existence of the android or ios directories
 * is required, or if tools like cocoapods need to be available.
 *
 * When the project uses custom build instructions, downloads builds from EAS,
 * or uses Expo Go, the IDE is not responsible for building the project, and hence
 * we don't want to report missing directories or tools as errors.
 */
async function projectRequiresNativeBuild(appRoot: string) {
  const launchConfiguration = getLaunchConfiguration();
  if (launchConfiguration.customBuild || launchConfiguration.eas) {
    return false;
  }

  return !(await isExpoGoProject(appRoot));
}
