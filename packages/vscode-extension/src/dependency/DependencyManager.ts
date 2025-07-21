import fs from "fs";
import path from "path";
import { EventEmitter } from "stream";
import { Disposable, OutputChannel } from "vscode";
import semver, { SemVer } from "semver";
import { Logger } from "../Logger";
import { EMULATOR_BINARY } from "../devices/AndroidEmulatorDevice";
import { command, exec } from "../utilities/subprocess";
import { getIosSourceDir } from "../builders/buildIOS";
import { isExpoGoProject } from "../builders/expoGo";
import {
  isNodeModulesInstalled,
  PackageManagerInfo,
  resolvePackageManager,
} from "../utilities/packageManager";
import {
  Dependency,
  DependencyListener,
  DependencyManagerInterface,
  DependencyStatus,
  MinSupportedVersion,
} from "../common/DependencyManager";
import { shouldUseExpoCLI } from "../utilities/expoCli";
import { CancelToken } from "../utilities/cancelToken";
import { getAndroidSourceDir } from "../builders/buildAndroid";
import { Platform } from "../utilities/platform";
import { requireNoCache } from "../utilities/requireNoCache";
import { getTelemetryReporter } from "../utilities/telemetry";
import { DevicePlatform } from "../common/DeviceManager";
import { isEasCliInstalled } from "../builders/easCommand";
import { getMinimumSupportedNodeVersion } from "../utilities/getMinimumSupportedNodeVersion";
import { LaunchConfiguration } from "../common/LaunchConfig";
import { BuildConfig, BuildType } from "../common/BuildConfig";
import { Pods } from "../utilities/pods";

export class DependencyManager implements Disposable, DependencyManagerInterface {
  // React Native prepares build scripts based on node_modules, we need to reinstall pods if they change
  private eventEmitter = new EventEmitter();
  private packageManagerInternal: PackageManagerInfo | undefined;
  private pods: Pods;

  constructor(private launchConfiguration: LaunchConfiguration) {
    this.pods = new Pods(launchConfiguration.absoluteAppRoot, launchConfiguration.env);
  }

  setLaunchConfiguration(newLaunchConfiguration: LaunchConfiguration) {
    const newRoot = newLaunchConfiguration.absoluteAppRoot;
    const appRoot = this.launchConfiguration.absoluteAppRoot;
    if (appRoot !== newRoot) {
      this.packageManagerInternal = undefined;
    }
    this.launchConfiguration = newLaunchConfiguration;
    const oldPods = this.pods;
    this.pods = new Pods(newRoot, newLaunchConfiguration.env);
    oldPods.dispose(); // dispose the old pods instance to clean up resources
  }

  public dispose() {
    this.eventEmitter.removeAllListeners();
    this.pods.dispose();
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
    const appRoot = this.launchConfiguration.absoluteAppRoot;
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
      isOptional: !shouldUseExpoCLI(this.launchConfiguration),
    });

    this.checkProjectUsesExpoRouter();
    this.checkProjectUsesStorybook();
    this.checkEasCliInstallationStatus();
  }

  public async ensureDependenciesForBuild(
    buildConfig: BuildConfig,
    outputChannel: OutputChannel,
    cancelToken: CancelToken
  ) {
    if (buildConfig.type === BuildType.Local) {
      if (buildConfig.platform === DevicePlatform.Android) {
        if (!(await this.checkAndroidDirectoryExits())) {
          throw new Error(
            'Your project does not have "android" directory. If this is an Expo project, you may need to run `expo prebuild` to generate missing files, or configure an external build source using launch configuration.'
          );
        }
      }
      if (buildConfig.platform === DevicePlatform.IOS) {
        if (!(await this.checkIOSDirectoryExists())) {
          throw new Error(
            'Your project does not have "ios" directory. If this is an Expo project, you may need to run `expo prebuild` to generate missing files, or configure an external build source using launch configuration.'
          );
        }
        await this.installPodsIfNeeded(buildConfig, outputChannel, cancelToken);
      }
    }
  }

  public async checkSupportedNodeVersionInstalled(): Promise<boolean> {
    const appRoot = this.launchConfiguration.absoluteAppRoot;
    try {
      const { stdout: nodeVersion } = await exec("node", ["-v"]);
      const minimumNodeVersion = getMinimumSupportedNodeVersion(appRoot);
      const isMinimumNodeVersion = semver.satisfies(nodeVersion, minimumNodeVersion);
      this.emitEvent("nodejs", {
        status: isMinimumNodeVersion ? "installed" : "notInstalled",
        isOptional: false,
      });
      return isMinimumNodeVersion;
    } catch {
      this.emitEvent("nodejs", { status: "notInstalled", isOptional: false });
      return false;
    }
  }

  public async checkAndroidDirectoryExits() {
    const appRoot = this.launchConfiguration.absoluteAppRoot;
    const androidDirPath = getAndroidSourceDir(appRoot);

    const isOptional = !(await projectRequiresNativeBuild(this.launchConfiguration));

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
    const appRoot = this.launchConfiguration.absoluteAppRoot;
    const iosDirPath = getIosSourceDir(appRoot);

    const isOptional = !(await projectRequiresNativeBuild(this.launchConfiguration));
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
    const appRoot = this.launchConfiguration.absoluteAppRoot;
    const dependsOnExpoRouter = appDependsOnExpoRouter(appRoot);
    const hasExpoRouterInstalled = npmPackageVersionCheck("expo-router", appRoot);

    this.emitEvent("expoRouter", {
      status: hasExpoRouterInstalled,
      isOptional: !dependsOnExpoRouter,
    });

    return dependsOnExpoRouter;
  }

  public async checkProjectUsesStorybook() {
    const appRoot = this.launchConfiguration.absoluteAppRoot;
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
    const appRoot = this.launchConfiguration.absoluteAppRoot;
    const packageManager = await this.getPackageManager();
    if (!packageManager) {
      return false;
    }

    this.emitEvent("nodeModules", { status: "installing", isOptional: false });

    try {
      // all package managers support the `install` command
      await command(`${packageManager.name} install`, {
        cwd: packageManager.workspacePath ?? appRoot,
        quietErrorsOnExit: true,
      });
    } catch (e) {
      Logger.error("Failed to install node modules", e);
      throw new Error("Failed to install node modules. Check the logs for details.");
    }

    this.emitEvent("nodeModules", { status: "installed", isOptional: false });

    return true;
  }

  private async installPods(outputChannel: OutputChannel, cancelToken: CancelToken) {
    getTelemetryReporter().sendTelemetryEvent("build:install-pods", {
      platform: DevicePlatform.IOS,
    });

    try {
      await this.pods.installPods(outputChannel, cancelToken);
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

  private async installPodsIfNeeded(
    { forceCleanBuild }: BuildConfig,
    outputChannel: OutputChannel,
    cancelToken: CancelToken
  ) {
    let shouldInstall = false;
    if (forceCleanBuild) {
      Logger.info("Clean build requested: installing pods");
      shouldInstall = true;
    } else if (!(await this.checkPodsInstallationStatus())) {
      Logger.info("Pods installation is missing or outdated. Installing Pods.");
      shouldInstall = true;
    }
    if (!shouldInstall) {
      return;
    }
    await this.installPods(outputChannel, cancelToken);
    const installed = await this.checkPodsInstallationStatus();
    if (!installed) {
      throw new Error(
        "Pods could not be installed in your project. Check the build logs for details."
      );
    }
  }

  private async getPackageManager() {
    if (!this.packageManagerInternal) {
      this.packageManagerInternal = await resolvePackageManager(this.launchConfiguration);
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

  private async checkPodsCommandStatus() {
    const installed = await this.pods.isPodsCommandInstalled();
    this.emitEvent("cocoaPods", {
      status: installed ? "installed" : "notInstalled",
      isOptional: !(await projectRequiresNativeBuild(this.launchConfiguration)),
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
    // the resolvePackageManager function in getPackageManager checks
    // if a package manager is installed and otherwise returns undefined
    const packageManager = await this.getPackageManager();
    this.emitEvent("packageManager", {
      status: packageManager ? "installed" : "notInstalled",
      isOptional: false,
      details: packageManager?.name,
    });
    return packageManager;
  }

  public async checkNodeModulesInstallationStatus() {
    const appRoot = this.launchConfiguration.absoluteAppRoot;
    const packageManager = await this.getPackageManager();
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
    const installed = await this.pods.arePodsInstalled();

    this.emitEvent("pods", {
      status: installed ? "installed" : "notInstalled",
      isOptional: false,
    });
    return installed;
  }

  public async checkEasCliInstallationStatus() {
    const appRoot = this.launchConfiguration.absoluteAppRoot;
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
async function projectRequiresNativeBuild(launchConfiguration: LaunchConfiguration) {
  if (launchConfiguration.customBuild || launchConfiguration.eas) {
    return false;
  }

  return !(await isExpoGoProject(launchConfiguration.appRoot));
}
