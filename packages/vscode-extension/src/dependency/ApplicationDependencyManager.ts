import fs from "fs";
import path from "path";
import { Disposable, OutputChannel } from "vscode";
import semver, { SemVer } from "semver";
import { Logger } from "../Logger";
import { exec } from "../utilities/subprocess";
import { getIosSourceDir } from "../builders/buildIOS";
import { isExpoGoProject } from "../builders/expoGo";
import { PackageManager } from "./packageManager";
import { shouldUseExpoCLI } from "../utilities/expoCli";
import { CancelToken } from "../utilities/cancelToken";
import { getAndroidSourceDir } from "../builders/buildAndroid";
import { Platform } from "../utilities/platform";
import { requireNoCache } from "../utilities/requireNoCache";
import { getTelemetryReporter } from "../utilities/telemetry";
import { DevicePlatform } from "../common/DeviceManager";
import { isEasCliInstalled } from "../builders/easCommand";
import { getMinimumSupportedNodeVersion } from "../utilities/getMinimumSupportedNodeVersion";
import { BuildConfig, BuildType } from "../common/BuildConfig";
import { Pods } from "./pods";
import { ResolvedLaunchConfig } from "../project/ApplicationContext";
import { StateManager } from "../project/StateManager";
import { disposeAll } from "../utilities/disposables";
import { MinSupportedVersion } from "../common/Constants";
import { ApplicationDependencyStatuses } from "../common/State";

export class ApplicationDependencyManager implements Disposable {
  private disposables: Disposable[] = [];

  private pods: Pods;
  private packageManager: PackageManager;

  constructor(
    private stateManager: StateManager<ApplicationDependencyStatuses>,
    private launchConfiguration: ResolvedLaunchConfig
  ) {
    this.pods = new Pods(launchConfiguration.absoluteAppRoot, launchConfiguration.env);
    this.packageManager = new PackageManager(launchConfiguration);

    this.runAllDependencyChecks();

    this.disposables.push(this.stateManager);
  }

  setLaunchConfiguration(newLaunchConfiguration: ResolvedLaunchConfig) {
    const newRoot = newLaunchConfiguration.absoluteAppRoot;
    this.launchConfiguration = newLaunchConfiguration;
    const oldPackageManager = this.packageManager;
    this.packageManager = new PackageManager(newLaunchConfiguration);
    oldPackageManager.dispose();
    const oldPods = this.pods;
    this.pods = new Pods(newRoot, newLaunchConfiguration.env);
    oldPods.dispose();

    this.runAllDependencyChecks();
  }

  public dispose() {
    this.pods.dispose();
    disposeAll(this.disposables);
  }

  public async runAllDependencyChecks() {
    this.checkAndroidDirectoryExits();

    if (Platform.OS === "macos") {
      this.checkIOSDirectoryExists();
      this.checkPodsCommandStatus();
      this.checkPodsInstallationStatus();
    }

    this.checkPackageManagerInstallationStatus();
    this.checkNodeModulesInstallationStatus();

    this.checkSupportedReactNativeInstalled();
    this.checkSupportedExpoInstalled();

    this.checkProjectUsesExpoRouter();
    this.checkProjectUsesStorybook();
    this.checkEasCliInstallationStatus();
  }

  public async checkSupportedReactNativeInstalled() {
    const appRoot = this.launchConfiguration.absoluteAppRoot;

    this.stateManager.setState({
      reactNative: {
        status: npmPackageVersionCheck("react-native", appRoot, MinSupportedVersion.reactNative),
        isOptional: false,
      },
    });
  }

  public async checkSupportedExpoInstalled() {
    const appRoot = this.launchConfiguration.absoluteAppRoot;

    this.stateManager.setState({
      expo: {
        status: npmPackageVersionCheck("expo", appRoot, MinSupportedVersion.expo),
        isOptional: !shouldUseExpoCLI(this.launchConfiguration),
      },
    });
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

  public async ensureDependenciesForStart(outputChannel: OutputChannel, cancelToken: CancelToken) {
    const packageManagerInstalled = await this.checkPackageManagerInstallationStatus();

    if (!packageManagerInstalled) {
      Logger.warn(
        "No package manager found. Please install npm, yarn, pnpm or bun to manage your project dependencies."
      );
    }

    const installed = await this.checkNodeModulesInstallationStatus();

    if (!installed) {
      Logger.info("Installing node modules");
      await this.installNodeModules(outputChannel, cancelToken);
      Logger.debug("Installing node modules succeeded");
    } else {
      Logger.debug("Node modules already installed - skipping");
    }

    const supportedNodeInstalled = await this.checkSupportedNodeVersionInstalled();
    if (!supportedNodeInstalled) {
      throw new Error(
        "Node.js was not found, or the version in the PATH does not satisfy minimum version requirements."
      );
    }
  }

  public async checkSupportedNodeVersionInstalled(): Promise<boolean> {
    const appRoot = this.launchConfiguration.absoluteAppRoot;
    try {
      const { stdout: nodeVersion } = await exec("node", ["-v"]);
      const minimumNodeVersion = getMinimumSupportedNodeVersion(appRoot);
      const isMinimumNodeVersion = semver.satisfies(nodeVersion, minimumNodeVersion);
      this.stateManager.setState({
        nodeVersion: {
          status: isMinimumNodeVersion ? "installed" : "notInstalled",
          isOptional: false,
        },
      });
      return isMinimumNodeVersion;
    } catch {
      this.stateManager.setState({ nodeVersion: { status: "notInstalled", isOptional: false } });
      return false;
    }
  }

  public async checkAndroidDirectoryExits() {
    const appRoot = this.launchConfiguration.absoluteAppRoot;
    const androidDirPath = getAndroidSourceDir(appRoot);

    const isOptional = !(await projectRequiresNativeBuild(this.launchConfiguration));

    try {
      await fs.promises.access(androidDirPath);
      this.stateManager.setState({ android: { status: "installed", isOptional } });
      return true;
    } catch (e) {
      this.stateManager.setState({ android: { status: "notInstalled", isOptional } });
      return isOptional;
    }
  }

  public async checkIOSDirectoryExists() {
    const appRoot = this.launchConfiguration.absoluteAppRoot;
    const iosDirPath = getIosSourceDir(appRoot);

    const isOptional = !(await projectRequiresNativeBuild(this.launchConfiguration));
    try {
      await fs.promises.access(iosDirPath);
      this.stateManager.setState({ ios: { status: "installed", isOptional } });
      return true;
    } catch (e) {
      this.stateManager.setState({ ios: { status: "notInstalled", isOptional } });
      return isOptional;
    }
  }

  public async checkProjectUsesExpoRouter() {
    const appRoot = this.launchConfiguration.absoluteAppRoot;
    const dependsOnExpoRouter = appDependsOnExpoRouter(appRoot);
    const hasExpoRouterInstalled = npmPackageVersionCheck("expo-router", appRoot);

    this.stateManager.setState({
      expoRouter: {
        status: hasExpoRouterInstalled,
        isOptional: !dependsOnExpoRouter,
      },
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
    this.stateManager.setState({
      storybook: {
        status: hasStotybookInstalled,
        isOptional: true,
      },
    });
    return hasStotybookInstalled;
  }

  public async installNodeModules(
    outputChannel: OutputChannel,
    cancelToken: CancelToken
  ): Promise<void> {
    this.stateManager.setState({ nodeModules: { status: "installing", isOptional: false } });

    try {
      await this.packageManager.installNodeModules(outputChannel, cancelToken);
      this.stateManager.setState({ nodeModules: { status: "installed", isOptional: false } });
    } catch (e) {
      this.stateManager.setState({ nodeModules: { status: "notInstalled", isOptional: false } });
      throw new Error("Failed to install node modules. Check the logs for details.");
    }
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
      this.stateManager.setState({ pods: { status: "notInstalled", isOptional: false } });
      return;
    }

    this.stateManager.setState({ pods: { status: "installed", isOptional: false } });
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

  private async checkPodsCommandStatus() {
    const installed = await this.pods.isPodsCommandInstalled();
    this.stateManager.setState({
      cocoaPods: {
        status: installed ? "installed" : "notInstalled",
        isOptional: !(await projectRequiresNativeBuild(this.launchConfiguration)),
      },
    });
  }

  private async checkPackageManagerInstallationStatus() {
    // the resolvePackageManager function in getPackageManager checks
    // if a package manager is installed and otherwise returns undefined
    const installed = await this.packageManager.isPackageManagerInstalled();
    this.stateManager.setState({
      packageManager: {
        status: installed ? "installed" : "notInstalled",
        isOptional: false,
      },
    });

    return installed;
  }

  public async checkNodeModulesInstallationStatus() {
    const installed = await this.packageManager.areNodeModulesInstalled();
    this.stateManager.setState({
      nodeModules: { status: installed ? "installed" : "notInstalled", isOptional: false },
    });
    return installed;
  }

  public async checkPodsInstallationStatus() {
    const installed = await this.pods.arePodsInstalled();

    this.stateManager.setState({
      pods: {
        status: installed ? "installed" : "notInstalled",
        isOptional: false,
      },
    });
    return installed;
  }

  public async checkEasCliInstallationStatus() {
    const appRoot = this.launchConfiguration.absoluteAppRoot;
    const installed = await isEasCliInstalled(appRoot);
    this.stateManager.setState({
      easCli: {
        status: installed ? "installed" : "notInstalled",
        isOptional: true,
      },
    });
    return;
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
async function projectRequiresNativeBuild(launchConfiguration: ResolvedLaunchConfig) {
  if (launchConfiguration.customBuild || launchConfiguration.eas) {
    return false;
  }

  return !(await isExpoGoProject(launchConfiguration.absoluteAppRoot));
}
