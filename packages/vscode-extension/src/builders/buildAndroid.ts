import fs from "fs";
import path from "path";
import semver from "semver";
import { AndroidConfig } from "@expo/config-plugins";
import loadConfig from "@react-native-community/cli-config";
import { calculateAppArtifactHash, getNativeABI } from "../utilities/common";
import { ANDROID_HOME, findJavaHome } from "../utilities/android";
import { Logger } from "../Logger";
import { exec, lineReader } from "../utilities/subprocess";
import { CancelToken } from "../utilities/cancelToken";
import { extensionContext } from "../utilities/extensionContext";
import { BuildAndroidProgressProcessor } from "./BuildAndroidProgressProcessor";
import { EXPO_GO_PACKAGE_NAME, downloadExpoGo } from "./expoGo";
import { getReactNativeVersion } from "../utilities/reactNative";
import { runExternalBuild } from "./customBuild";
import { fetchEasBuild, performLocalEasBuild } from "./eas";
import { getTelemetryReporter } from "../utilities/telemetry";
import {
  AndroidBuildConfig,
  AndroidDevClientBuildConfig,
  AndroidLocalBuildConfig,
  BuildType,
} from "../common/BuildConfig";
import { DevicePlatform } from "../common/State";
import { BuildOptions } from "./BuildManager";

export type AndroidBuildResult = {
  platform: DevicePlatform.Android;
  apkPath: string;
  packageName: string;
  launchActivity?: string;
  buildHash: string;
};

const BUILD_TOOLS_PATH = path.join(ANDROID_HOME, "build-tools");
const RELATIVE_APK_DIR = "app/build/outputs/apk";

// Assuming users have android folder in their project's root
export const getAndroidSourceDir = (appRootFolder: string) => path.join(appRootFolder, "android");

function locateAapt() {
  // search for aapt binary under BUILD_TOOLS_PATH/<version>/aapt
  // since we only need aapt to extract package name, we can use any version.
  // However, on M1 macs, aapt we noticed that older aapt versions may not work
  // as they may require rosetta, so we try to find the latest version.
  const versions = fs.readdirSync(BUILD_TOOLS_PATH);
  const latestVersion = versions.sort().reverse()[0];
  return path.join(BUILD_TOOLS_PATH, latestVersion, "aapt");
}

/**
 * This function extracts the application Id that allows for identifying the application
 * while managing its runtime it might be defined by multiple configurations
 * https://developer.android.com/build/configure-app-module
 * @param artifactPath
 * @param cancelToken
 * @returns Promise<string>
 */
async function extractAppId(artifactPath: string, cancelToken: CancelToken) {
  const aaptPath = locateAapt();
  const { stdout } = await cancelToken.adapt(exec(aaptPath, ["dump", "badging", artifactPath]));
  const packageLine = stdout.split("\n").find((line: string) => line.startsWith("package: name="));
  const appId = packageLine!.split("'")[1];
  return appId;
}

async function getApplicationManifest(
  projectRoot: string
): Promise<AndroidConfig.Manifest.AndroidManifest | undefined> {
  try {
    const filePath = await AndroidConfig.Paths.getAndroidManifestAsync(projectRoot);
    const androidManifest = await AndroidConfig.Manifest.readAndroidManifestAsync(filePath);

    if (!androidManifest) {
      return undefined;
    }
    return androidManifest;
  } catch (e) {
    // ignore errors and just return undefined here
  }
  return undefined;
}

async function resolveAppIdFromNativeAsync(projectRoot: string): Promise<string | null> {
  const applicationIdFromGradle = await AndroidConfig.Package.getApplicationIdAsync(
    projectRoot
  ).catch(() => null);
  if (applicationIdFromGradle) {
    return applicationIdFromGradle;
  }

  try {
    const filePath = await AndroidConfig.Paths.getAndroidManifestAsync(projectRoot);
    const androidManifest = await AndroidConfig.Manifest.readAndroidManifestAsync(filePath);
    // Assert MainActivity defined.
    await AndroidConfig.Manifest.getMainActivityOrThrow(androidManifest);
    if (androidManifest.manifest?.$?.package) {
      return androidManifest.manifest.$.package;
    }
  } catch (error: any) {
    Logger.debug("Expected error resolving the package name from the AndroidManifest.xml:", error);
  }

  return null;
}

async function getLaunchActivityAsync(
  projectRoot: string,
  appId: string
): Promise<string | undefined> {
  const manifest = await getApplicationManifest(projectRoot);
  if (!manifest) return undefined;

  const mainActivity = await AndroidConfig.Manifest.getRunnableActivity(manifest);
  if (!mainActivity) return undefined;

  const mainActivityName = mainActivity.$["android:name"];

  const packageName = await resolveAppIdFromNativeAsync(projectRoot);

  // note(Filip Kamiński): returning anything other then undefined from this helper
  // will affect how the application is launched; instead of using the default
  // "android.intent.action.VIEW" intent we will use returned launch activity.
  // Launching using launchActivity is a more precise way of doing it and in some setups
  // a necessary one, as using the default path might lead to some deep linking issues,
  // with newly opened application routing to unexpected screens, but it is not extensively tested
  // in production, so we restrain the usage of it only to the situations in which we observed
  // a problem: when appId used by build application is different then the one defined by the
  // applications manifest. It is quite common and happens when the productFlavor or buildType
  // defines a special prefix/suffix to the appId. Most of the code is inspired by how expo CLI
  // handles this case with the added bonus that radons solution does not require additional
  // user configuration. You can explore the expo solution here:
  // https://github.com/expo/expo/blob/645e63df903d28149ee9eda6682f6032b31601d7/packages/%40expo/cli/src/start/platforms/android/AndroidPlatformManager.ts#L93
  if (packageName == appId) {
    return undefined;
  }

  // Note(Filip Kamiński) This is not supported by the expo version at the time this code wa written,
  // but seems to be an important edge case for at least one project considering using Radon,
  // they even opened a PR to expo to support activities with domain names.
  // https://github.com/expo/expo/pull/39236
  const combinedMainActivity = mainActivityName.startsWith(".")
    ? `${packageName}${mainActivityName}`
    : mainActivityName;

  // the generation of the launch activity is inspired by expo CLI and good entry point to find out more
  // is here https://github.com/expo/expo/blob/main/packages/%40expo/cli/src/run/android/resolveLaunchProps.ts
  return `${appId}/${combinedMainActivity}`;
}

function getApkPath(appRootFolder: string, productFlavor: string, buildType: string) {
  const androidSourceDir = getAndroidSourceDir(appRootFolder);
  const apkFile = ["app", productFlavor, buildType].filter(Boolean).join("-") + ".apk";
  return path.join(androidSourceDir, RELATIVE_APK_DIR, productFlavor, buildType, apkFile);
}

export async function getAndroidBuildPaths(
  appRootFolder: string,
  cancelToken: CancelToken,
  productFlavor: string,
  buildType: string
) {
  const apkPath = getApkPath(appRootFolder, productFlavor, buildType);
  const packageName = await extractAppId(apkPath, cancelToken);

  const launchActivity = await cancelToken.adapt(
    getLaunchActivityAsync(appRootFolder, packageName)
  );

  return { apkPath, packageName, launchActivity };
}

function makeBuildTaskName(productFlavor: string, buildType: string, appName?: string) {
  // task name is in the format of :<appName>:assemble<ProductFlavor><BuildType> where productFlavor and buildType
  // are the names of the productFlavor and buildType that each start with a capital letter.
  // By default, Android Gradle Plugin always creates staging and release buildTypes and does not define any productFlavor.
  // and appName is the name of the application as seen by the gradle build system, omitting appName leads to
  // whole android project being build.
  const flavorUppercase =
    productFlavor && productFlavor.charAt(0).toUpperCase() + productFlavor.slice(1);
  const buildTypeUppercase = buildType && buildType.charAt(0).toUpperCase() + buildType.slice(1);
  const prefix = appName ? `:${appName}:` : "";
  return `${prefix}assemble${flavorUppercase}${buildTypeUppercase}`;
}

export async function buildAndroid(
  buildConfig: AndroidBuildConfig,
  buildOptions: BuildOptions
): Promise<AndroidBuildResult> {
  const { appRoot, env, type: buildType } = buildConfig;
  const { cancelToken, buildOutputChannel } = buildOptions;

  switch (buildType) {
    case BuildType.Custom: {
      getTelemetryReporter().sendTelemetryEvent("build:custom-build-requested", {
        platform: DevicePlatform.Android,
      });
      const apkPath = await runExternalBuild(
        cancelToken,
        buildConfig.buildCommand,
        env,
        DevicePlatform.Android,
        appRoot,
        buildOutputChannel
      );
      if (!apkPath) {
        throw new Error(
          "Failed to build Android app using custom script. See the build logs for details."
        );
      }

      return {
        apkPath,
        packageName: await extractAppId(apkPath, cancelToken),
        platform: DevicePlatform.Android,
        buildHash: await calculateAppArtifactHash(apkPath),
      };
    }
    case BuildType.Eas: {
      getTelemetryReporter().sendTelemetryEvent("build:eas-build-requested", {
        platform: DevicePlatform.Android,
      });
      const apkPath = await fetchEasBuild(
        cancelToken,
        buildConfig.config,
        DevicePlatform.Android,
        appRoot,
        buildOutputChannel
      );

      return {
        apkPath,
        packageName: await extractAppId(apkPath, cancelToken),
        platform: DevicePlatform.Android,
        buildHash: await calculateAppArtifactHash(apkPath),
      };
    }
    case BuildType.EasLocal: {
      getTelemetryReporter().sendTelemetryEvent("build:eas-local-build-requested", {
        platform: DevicePlatform.Android,
      });
      const apkPath = await performLocalEasBuild(
        buildConfig.profile,
        DevicePlatform.Android,
        appRoot,
        buildOutputChannel,
        cancelToken
      );

      return {
        apkPath,
        packageName: await extractAppId(apkPath, cancelToken),
        platform: DevicePlatform.Android,
        buildHash: await calculateAppArtifactHash(apkPath),
      };
    }
    case BuildType.ExpoGo: {
      getTelemetryReporter().sendTelemetryEvent("build:expo-go-requested", {
        platform: DevicePlatform.Android,
      });
      const apkPath = await downloadExpoGo(DevicePlatform.Android, cancelToken, appRoot);
      return {
        apkPath,
        packageName: EXPO_GO_PACKAGE_NAME,
        platform: DevicePlatform.Android,
        buildHash: await calculateAppArtifactHash(apkPath),
      };
    }
    case BuildType.DevClient:
    case BuildType.Local: {
      return await buildLocal(buildConfig, buildOptions);
    }
  }
}

async function buildLocal(
  buildConfig: AndroidLocalBuildConfig | AndroidDevClientBuildConfig,
  buildOptions: BuildOptions
): Promise<AndroidBuildResult> {
  let { appRoot, env, productFlavor = "", buildType = "debug" } = buildConfig;
  const { progressListener, cancelToken, buildOutputChannel, forceCleanBuild } = buildOptions;
  const androidSourceDir = getAndroidSourceDir(appRoot);
  const androidAppName = loadConfig({
    projectRoot: appRoot,
    selectedPlatform: "android",
  }).platforms.android?.projectConfig(appRoot)?.appName;

  const gradleArgs = [
    "-x",
    "lint",
    `-PreactNativeArchitectures=${getNativeABI()}`,
    ...(forceCleanBuild ? ["clean"] : []),
    makeBuildTaskName(productFlavor, buildType, androidAppName),
    "--init-script", // buildProgressEvaluation init script is used log build task count for build progress logging
    path.join(
      extensionContext.extensionPath,
      "lib",
      "android",
      "buildProgressEvaluation.initscript.gradle"
    ),
  ];
  // configureReactNativeOverrides init script is only necessary for RN versions older then 0.74.0 see comments in configureReactNativeOverrides.gradle for more details
  if (semver.lt(getReactNativeVersion(appRoot), "0.74.0")) {
    gradleArgs.push(
      "--init-script", // configureReactNativeOverrides init script is used to patch React Android project, see comments in configureReactNativeOverrides.gradle for more details
      path.join(
        extensionContext.extensionPath,
        "lib",
        "android",
        "configureReactNativeOverrides.initscript.gradle"
      )
    );
  }
  Logger.debug("Starting Android build");
  const JAVA_HOME = await findJavaHome();
  const buildProcess = cancelToken.adapt(
    exec("./gradlew", gradleArgs, {
      cwd: androidSourceDir,
      env: { JAVA_HOME, ANDROID_HOME, ...env },
      buffer: false,
    })
  );
  const buildAndroidProgressProcessor = new BuildAndroidProgressProcessor(progressListener);
  lineReader(buildProcess).onLineRead((line) => {
    buildOutputChannel.appendLine(line);
    buildAndroidProgressProcessor.processLine(line);
  });

  try {
    await buildProcess;
  } catch (e) {
    Logger.error("Android build failed", e);
    throw new Error("Failed to build the Android app with gradle. See the build logs for details.");
  }
  Logger.debug("Android build successful");
  try {
    const apkInfo = await getAndroidBuildPaths(appRoot, cancelToken, productFlavor, buildType);
    return {
      ...apkInfo,
      platform: DevicePlatform.Android,
      buildHash: await calculateAppArtifactHash(apkInfo.apkPath),
    };
  } catch (e) {
    Logger.error("Failed to extract package name from APK", e);
    throw new Error(
      "The Android build was successful, but the APK file could not be accessed. " +
        "See the build logs for details. "
    );
  }
}
