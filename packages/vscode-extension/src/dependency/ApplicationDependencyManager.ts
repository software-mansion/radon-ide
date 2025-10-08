import path from "path";
import { Disposable, OutputChannel } from "vscode";
import semver, { SemVer } from "semver";
import { Logger } from "../Logger";
import { exec } from "../utilities/subprocess";
import { isExpoGoProject } from "../builders/expoGo";
import { PackageManager } from "./packageManager";
import { shouldUseExpoCLI } from "../utilities/expoCli";
import { CancelError, CancelToken } from "../utilities/cancelToken";
import { Platform } from "../utilities/platform";
import { requireNoCache } from "../utilities/requireNoCache";
import { getTelemetryReporter } from "../utilities/telemetry";
import { isEasCliInstalled } from "../builders/easCommand";
import { getMinimumSupportedNodeVersion } from "../utilities/getMinimumSupportedNodeVersion";
import { BuildConfig, BuildType } from "../common/BuildConfig";
import { Pods } from "./pods";
import { ResolvedLaunchConfig } from "../project/ApplicationContext";
import { StateManager } from "../project/StateManager";
import { disposeAll } from "../utilities/disposables";
import { MinSupportedVersion } from "../common/Constants";
import { ApplicationDependencyStatuses, DevicePlatform } from "../common/State";
import { BuildError, BuildOptions } from "../builders/BuildManager";
import { Prebuild } from "./prebuild";
import { FingerprintProvider } from "../project/FingerprintProvider";
import { checkNativeDirectoryExists } from "../utilities/checkNativeDirectoryExists";

export class ApplicationDependencyManager implements Disposable {
  private disposables: Disposable[] = [];

  private pods: Pods;
  private packageManager: PackageManager;
  private prebuild: Prebuild;

  constructor(
    private stateManager: StateManager<ApplicationDependencyStatuses>,
    private launchConfiguration: ResolvedLaunchConfig,
    private fingerprintProvider: FingerprintProvider
  ) {
    this.pods = new Pods(launchConfiguration.absoluteAppRoot, launchConfiguration.env);
    this.packageManager = new PackageManager(launchConfiguration);
    this.prebuild = new Prebuild(fingerprintProvider);

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
    const oldPrebuild = this.prebuild;
    this.prebuild = new Prebuild(this.fingerprintProvider);
    oldPrebuild.dispose();

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

    this.stateManager.updateState({
      reactNative: {
        status: npmPackageVersionCheck("react-native", appRoot, MinSupportedVersion.reactNative),
        isOptional: false,
      },
    });
  }

  public async checkSupportedExpoInstalled() {
    const appRoot = this.launchConfiguration.absoluteAppRoot;

    this.stateManager.updateState({
      expo: {
        status: npmPackageVersionCheck("expo", appRoot, MinSupportedVersion.expo),
        isOptional: !shouldUseExpoCLI(this.launchConfiguration),
      },
    });
  }

  public async ensureDependenciesForBuild(buildConfig: BuildConfig, buildOptions: BuildOptions) {
    if (buildConfig.type === BuildType.Local || buildConfig.type === BuildType.DevClient) {
      if ((buildConfig.type === BuildType.DevClient && buildConfig.usePrebuild !== false) || buildConfig.usePrebuild) {
        try {
          await this.prebuild.runPrebuildIfNeeded(buildConfig, buildOptions);
        } catch (e) {
          if (e instanceof BuildError || e instanceof CancelError) {
            throw e;
          }
          throw new BuildError(
            "Running Prebuild failed. Check the build logs for details.",
            buildConfig.type
          );
        }
      }
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
        await this.installPodsIfNeeded(buildOptions);
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

    const { requiredNodeInstalled, installedVersion, minimumVersion } =
      await this.checkRequiredNodeVersionInstalled();
    if (!requiredNodeInstalled) {
      if (installedVersion) {
        throw new Error(
          `Node.js version mismatch: Found version ${installedVersion} but minimum required is ${minimumVersion}.`
        );
      }
      throw new Error("Node.js executable was not found in the PATH.");
    }
  }

  private async checkRequiredNodeVersionInstalled() {
    const appRoot = this.launchConfiguration.absoluteAppRoot;
    const minimumNodeVersion = getMinimumSupportedNodeVersion(appRoot);
    try {
      const { stdout: nodeVersion } = await exec("node", ["-v"]);
      const isMinimumNodeVersion = semver.satisfies(nodeVersion, minimumNodeVersion);
      this.stateManager.updateState({
        nodeVersion: {
          status: isMinimumNodeVersion ? "installed" : "notInstalled",
          isOptional: false,
        },
      });
      return {
        requiredNodeInstalled: isMinimumNodeVersion,
        installedVersion: nodeVersion,
        minimumVersion: minimumNodeVersion,
      };
    } catch {
      this.stateManager.updateState({
        nodeVersion: {
          status: "notInstalled",
          isOptional: false,
        },
      });
      return {
        requiredNodeInstalled: false,
        installedVersion: undefined,
        minimumVersion: minimumNodeVersion,
      };
    }
  }

  public async checkAndroidDirectoryExits() {
    const appRoot = this.launchConfiguration.absoluteAppRoot;

    const isOptional = !(await projectRequiresNativeBuild(
      this.launchConfiguration,
      DevicePlatform.Android
    ));

    const exists = await checkNativeDirectoryExists(appRoot, DevicePlatform.Android);
    this.stateManager.updateState({
      android: { status: exists ? "installed" : "notInstalled", isOptional },
    });
    return exists || isOptional;
  }

  public async checkIOSDirectoryExists() {
    const appRoot = this.launchConfiguration.absoluteAppRoot;

    const isOptional = !(await projectRequiresNativeBuild(
      this.launchConfiguration,
      DevicePlatform.IOS
    ));

    const exists = await checkNativeDirectoryExists(appRoot, DevicePlatform.IOS);
    this.stateManager.updateState({
      ios: { status: exists ? "installed" : "notInstalled", isOptional },
    });
    return exists || isOptional;
  }

  public async checkProjectUsesExpoRouter() {
    const appRoot = this.launchConfiguration.absoluteAppRoot;
    const dependsOnExpoRouter = appDependsOnExpoRouter(appRoot);
    const hasExpoRouterInstalled = npmPackageVersionCheck("expo-router", appRoot);

    this.stateManager.updateState({
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
    this.stateManager.updateState({
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
    this.stateManager.updateState({ nodeModules: { status: "installing", isOptional: false } });

    try {
      await this.packageManager.installNodeModules(outputChannel, cancelToken);
      this.stateManager.updateState({ nodeModules: { status: "installed", isOptional: false } });
    } catch (e) {
      this.stateManager.updateState({ nodeModules: { status: "notInstalled", isOptional: false } });
      throw new Error("Failed to install node modules. Check the logs for details.");
    }
  }

  private async installPods(buildOptions: BuildOptions) {
    getTelemetryReporter().sendTelemetryEvent("build:install-pods", {
      platform: DevicePlatform.IOS,
    });

    try {
      await this.pods.installPods(buildOptions);
    } catch (e) {
      Logger.error("Pods not installed", e);
      getTelemetryReporter().sendTelemetryEvent("build:pod-install-failed", {
        platform: DevicePlatform.IOS,
      });
      this.stateManager.updateState({ pods: { status: "notInstalled", isOptional: false } });
      return;
    }

    this.stateManager.updateState({ pods: { status: "installed", isOptional: false } });
    Logger.debug("Project pods installed");
  }

  private async installPodsIfNeeded(buildOptions: BuildOptions) {
    const { forceCleanBuild } = buildOptions;
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
    await this.installPods(buildOptions);
    const installed = await this.checkPodsInstallationStatus();
    if (!installed) {
      throw new Error(
        "Pods could not be installed in your project. Check the build logs for details."
      );
    }
  }

  private async checkPodsCommandStatus() {
    const installed = await this.pods.isPodsCommandInstalled();
    this.stateManager.updateState({
      cocoaPods: {
        status: installed ? "installed" : "notInstalled",
        isOptional: !(await projectRequiresNativeBuild(
          this.launchConfiguration,
          DevicePlatform.IOS
        )),
      },
    });
  }

  private async checkPackageManagerInstallationStatus() {
    // the resolvePackageManager function in getPackageManager checks
    // if a package manager is installed and otherwise returns undefined
    const installed = await this.packageManager.isPackageManagerInstalled();
    this.stateManager.updateState({
      packageManager: {
        status: installed ? "installed" : "notInstalled",
        isOptional: false,
      },
    });

    return installed;
  }

  public async checkNodeModulesInstallationStatus() {
    const installed = await this.packageManager.areNodeModulesInstalled();
    this.stateManager.updateState({
      nodeModules: { status: installed ? "installed" : "notInstalled", isOptional: false },
    });
    return installed;
  }

  public async checkPodsInstallationStatus() {
    const installed = await this.pods.arePodsInstalled();

    this.stateManager.updateState({
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
    this.stateManager.updateState({
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
async function projectRequiresNativeBuild(
  launchConfiguration: ResolvedLaunchConfig,
  platform: DevicePlatform
) {
  if (launchConfiguration.customBuild || launchConfiguration.eas) {
    return false;
  }

  return !(await isExpoGoProject(launchConfiguration.absoluteAppRoot, platform));
}
