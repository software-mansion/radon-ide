import fs from "fs";
import { homedir } from "os";
import path from "path";
import { Uri, version as vscodeVersion, window, env } from "vscode";
import { Output } from "../common/OutputChannel";
import { OutputChannelRegistry } from "../project/OutputChannelRegistry";
import { getTimestamp } from "./getTimestamp";
import { Platform } from "./platform";
import {
  ApplicationDependencyStatuses,
  EnvironmentDependencyStatuses,
  DependencyStatus,
} from "../common/State";
import { Logger } from "../Logger";

/**
 * Strips sensitive information from text content
 * @param content The content to sanitize
 * @returns The sanitized content
 */
function stripSensitiveInfo(content: string): string {
  // Get the username
  const username = homedir().split(path.sep).pop() || "";

  // Replace username occurrences
  if (username) {
    const usernameRegex = new RegExp(username, "g");
    content = content.replace(usernameRegex, "<username>");
  }

  // Replace home directory paths
  const homeDir = homedir();
  if (homeDir) {
    const homeDirRegex = new RegExp(homeDir.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
    content = content.replace(homeDirRegex, "<home>");
  }

  return content;
}

/**
 * Formats dependency information for the report
 */
function formatDependencies(dependencies: Partial<Record<string, DependencyStatus>>): string[] {
  const lines: string[] = [];

  for (const [name, info] of Object.entries(dependencies)) {
    if (info) {
      lines.push(`  ${name}: ${info.status}${info.isOptional ? " (optional)" : ""}`);
      if (info.details) {
        lines.push(`    Details: ${stripSensitiveInfo(info.details)}`);
      }
    }
  }

  return lines;
}

/**
 * Collects output channel logs
 */
function collectOutputChannelLogs(outputChannelRegistry: OutputChannelRegistry): string {
  const sections: string[] = [];

  // Collect logs from all channels
  const channels: Output[] = [
    Output.BuildIos,
    Output.BuildAndroid,
    Output.AndroidDevice,
    Output.IosDevice,
    Output.PackageManager,
    Output.MetroBundler,
  ];

  for (const channel of channels) {
    try {
      const outputChannel = (outputChannelRegistry as any).channelByName?.get(channel);
      if (outputChannel && !outputChannel.isEmpty()) {
        sections.push(`\n## ${channel}\n`);
        const logs = outputChannel.readAll();
        const sanitizedLogs = logs.map((line) => stripSensitiveInfo(line)).join("");
        sections.push(sanitizedLogs);
      }
    } catch (error) {
      Logger.debug(`Failed to read logs from ${channel}:`, error);
    }
  }

  return sections.join("\n");
}

/**
 * Gets package manager information from package.json
 */
async function getPackageManagerInfo(appRootPath?: string): Promise<string> {
  if (!appRootPath) {
    return "Package manager: Not available (no app root)";
  }

  try {
    const packageJsonPath = path.join(appRootPath, "package.json");
    const packageJson = JSON.parse(await fs.promises.readFile(packageJsonPath, "utf8"));

    const lines: string[] = ["Package information:"];

    // React Native version
    if (packageJson.dependencies?.["react-native"]) {
      lines.push(`  React Native: ${packageJson.dependencies["react-native"]}`);
    }

    // Expo version
    if (packageJson.dependencies?.expo) {
      lines.push(`  Expo: ${packageJson.dependencies.expo}`);
    }

    // Package manager
    if (packageJson.packageManager) {
      lines.push(`  Package Manager: ${packageJson.packageManager}`);
    }

    return lines.join("\n");
  } catch (error) {
    return "Package information: Unable to read package.json";
  }
}

/**
 * Generates a comprehensive diagnostic report
 */
export async function generateDiagnosticReport(
  extensionVersion: string,
  appRootPath: string | undefined,
  applicationDependencies: ApplicationDependencyStatuses,
  environmentDependencies: EnvironmentDependencyStatuses,
  outputChannelRegistry: OutputChannelRegistry
): Promise<string> {
  const reportLines: string[] = [];

  // Header
  reportLines.push("# Radon IDE Diagnostic Report");
  reportLines.push(`Generated: ${new Date().toISOString()}`);
  reportLines.push("");

  // System Information
  reportLines.push("## System Information");
  reportLines.push(`Platform: ${Platform.OS}`);
  reportLines.push(`Extension Version: ${extensionVersion}`);

  // Detect if running in Cursor
  const isCursor = env.appName.toLowerCase().includes("cursor");
  if (isCursor) {
    reportLines.push(`IDE: Cursor (${env.appName})`);
  } else {
    reportLines.push(`VSCode Version: ${vscodeVersion}`);
  }

  reportLines.push("");

  // Project Information
  reportLines.push("## Project Information");
  if (appRootPath) {
    reportLines.push(`App Root: <app-root>`);
  } else {
    reportLines.push(`App Root: Not detected`);
  }

  const packageInfo = await getPackageManagerInfo(appRootPath);
  reportLines.push(packageInfo);
  reportLines.push("");

  // Environment Dependencies
  reportLines.push("## Environment Dependencies");
  reportLines.push(...formatDependencies(environmentDependencies));
  reportLines.push("");

  // Application Dependencies
  reportLines.push("## Application Dependencies");
  reportLines.push(...formatDependencies(applicationDependencies));
  reportLines.push("");

  // Output Channel Logs
  reportLines.push("# Output Channel Logs");
  reportLines.push("");
  reportLines.push(
    "Note: The main 'Radon IDE' output channel logs are not included in this report."
  );
  reportLines.push("If needed, you can access them via View > Output > Radon IDE.");
  reportLines.push("");
  const logs = collectOutputChannelLogs(outputChannelRegistry);
  reportLines.push(logs);

  return reportLines.join("\n");
}

/**
 * Saves the diagnostic report to a file
 */
export async function saveDiagnosticReport(
  extensionVersion: string,
  appRootPath: string | undefined,
  applicationDependencies: ApplicationDependencyStatuses,
  environmentDependencies: EnvironmentDependencyStatuses,
  outputChannelRegistry: OutputChannelRegistry,
  defaultSavingLocation?: string
): Promise<boolean> {
  try {
    const timestamp = getTimestamp();
    const fileName = `radon-ide-diagnostic-${timestamp}.txt`;

    const defaultFolder =
      defaultSavingLocation && fs.existsSync(defaultSavingLocation)
        ? defaultSavingLocation
        : Platform.select({
            macos: path.join(homedir(), "Desktop"),
            windows: homedir(),
            linux: homedir(),
          });
    const defaultUri = Uri.file(path.join(defaultFolder, fileName));

    // Open save dialog
    const saveUri = await window.showSaveDialog({
      defaultUri: defaultUri,
      filters: {
        "Text Files": ["txt"],
      },
      saveLabel: "Save Diagnostic Report",
    });

    if (!saveUri) {
      return false;
    }

    // Generate report content
    const reportContent = await generateDiagnosticReport(
      extensionVersion,
      appRootPath,
      applicationDependencies,
      environmentDependencies,
      outputChannelRegistry
    );

    // Write to file
    await fs.promises.writeFile(saveUri.fsPath, reportContent, "utf8");

    window.showInformationMessage(`Diagnostic report saved to ${saveUri.fsPath}`);
    return true;
  } catch (error) {
    Logger.error("Failed to save diagnostic report:", error);
    window.showErrorMessage("Failed to save diagnostic report. Please check the logs.");
    return false;
  }
}
