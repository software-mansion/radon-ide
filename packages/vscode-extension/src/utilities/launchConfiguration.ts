import { DebugConfiguration, workspace } from "vscode";
import { LaunchOptions } from "../common/LaunchConfig";
import { IOSBuildResult } from "../builders/buildIOS";
import { DevicePlatform } from "../common/DeviceManager";
import { AndroidBuildResult } from "../builders/buildAndroid";

/**
 * Represents a launch configuration for Radon IDE, serialized into the format used in VS Code's launch.json.
 */
export interface LaunchRadonConfig extends LaunchOptions {
  name: string;
  type: "react-native-ide" | "radon-ide";
  request: "launch";
}

export function getLaunchConfiguration() {
  const ideConfig = workspace.getConfiguration("launch")?.configurations?.find(isIdeConfig) ?? {};

  return ideConfig;
}

export function getIOSConfiguration(): IOSBuildResult | undefined {
  const launchConfig = workspace.getConfiguration("launch");
  const configurations = launchConfig?.configurations;

  if (!configurations || !Array.isArray(configurations) || configurations.length === 0) {
    return undefined;
  }

  const iosInfo = configurations[0]?.ios;
  if (!iosInfo?.appPath || !iosInfo?.bundleID) {
    return undefined;
  }

  return {
    platform: DevicePlatform.IOS,
    bundleID: iosInfo.bundleID,
    appPath: iosInfo.appPath,
  };
}

export function getAndroidConfiguration(): AndroidBuildResult | undefined {
  const launchConfig = workspace.getConfiguration("launch");
  const configurations = launchConfig?.configurations;

  if (!configurations || !Array.isArray(configurations) || configurations.length === 0) {
    return undefined;
  }

  const androidInfo = configurations[0]?.android;
  if (!androidInfo?.apkPath || !androidInfo?.packageName) {
    return undefined;
  }

  return {
    platform: DevicePlatform.Android,
    packageName: androidInfo.packageName,
    apkPath: androidInfo.apkPath,
  };
}

export function getCustomDevCommand() {
  const launchConfig = workspace.getConfiguration("launch");
  const configurations = launchConfig?.configurations;
  const devCommand = configurations[0]?.devCommand;
  return devCommand;
}

export function getPortConfiguration() {
  const launchConfig = workspace.getConfiguration("launch");
  const configurations = launchConfig?.configurations;
  const port = configurations[0]?.port;
  return port;
}

export function getRootFileNameConfiguration() {
  const launchConfig = workspace.getConfiguration("launch");
  const configurations = launchConfig?.configurations;
  const rootFileName = configurations[0]?.rootFileName;
  return rootFileName;
}

export function getLaunchConfigurations(): Array<LaunchRadonConfig> {
  const ideConfigs =
    workspace.getConfiguration("launch")?.configurations?.filter(isIdeConfig) ?? [];

  return ideConfigs;
}

export function isIdeConfig(config: DebugConfiguration): config is LaunchRadonConfig {
  return config.type === "react-native-ide" || config.type === "radon-ide"; // we keep previous type name for compatibility with old configuration files
}
