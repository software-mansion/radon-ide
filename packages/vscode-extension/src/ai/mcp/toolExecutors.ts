import { readFileSync } from "fs";

import { IDE } from "../../project/ide";
import { pngToToolContent, textToToolContent, textToToolResponse } from "./utils";
import { TextContent, ToolResponse } from "./models";
import { Output } from "../../common/OutputChannel";
import { DevicePlatform } from "../../common/State";
import { ReloadAction } from "../../project/DeviceSessionsManager";

export async function screenshotToolExec(): Promise<ToolResponse> {
  const project = IDE.getInstanceIfExists()?.project;

  if (!project || !project.deviceSession) {
    return textToToolResponse(
      "Could not capture a screenshot!\n" +
        "The development viewport device is likely turned off.\n" +
        "Please turn on the Radon IDE emulator before proceeding."
    );
  }

  const screenshot = await project.getScreenshot();

  const contents = readFileSync(screenshot.tempFileLocation, { encoding: "base64" });

  return {
    content: [pngToToolContent(contents)],
  };
}

interface AppReloadRequest {
  // Limiting the reload options to these three basic methods,
  // as others require too much nuance and domain specific knowledge from the AI.
  reloadMethod: Extract<ReloadAction, "reloadJs" | "rebuild" | "restartProcess">;
}

export async function restartDeviceExec(input: AppReloadRequest): Promise<ToolResponse> {
  const project = IDE.getInstanceIfExists()?.project;

  if (!project || !project.deviceSession) {
    return textToToolResponse(
      "Could not reload the app!" +
        "The development device is likely turned off.\n" +
        "Please turn on the Radon IDE emulator before proceeding."
    );
  }

  try {
    // `reloadCurrentSession` awaits `stateManager.status` to be set to `running` before returning.
    await project.reloadCurrentSession(input.reloadMethod);
    return textToToolResponse("App reloaded successfully.");
  } catch (error) {
    return textToToolResponse(`Failed to reload the app. Details: ${String(error)}`);
  }
}

export async function readLogsToolExec(): Promise<ToolResponse> {
  const ideInstance = IDE.getInstanceIfExists();

  if (!ideInstance) {
    return textToToolResponse(
      "Couldn't retrieve build logs - Radon IDE is not launched. Open Radon IDE first."
    );
  }

  const registry = ideInstance.outputChannelRegistry;
  const session = ideInstance.project.deviceSession;

  if (!session) {
    return textToToolResponse(
      "Couldn't retrieve build logs - Radon IDE hasn't run any build. " +
        "You need to select a project and a device in Radon IDE panel."
    );
  }

  const isAndroid = session.platform === DevicePlatform.Android;

  const buildLogs = registry.getOrCreateOutputChannel(
    isAndroid ? Output.BuildAndroid : Output.BuildIos
  );

  const packageManagerLogs = registry.getOrCreateOutputChannel(Output.PackageManager);

  const metroLogs = registry.getOrCreateOutputChannel(Output.MetroBundler);

  const deviceLogs = registry.getOrCreateOutputChannel(
    isAndroid ? Output.AndroidDevice : Output.IosDevice
  );

  const combinedLogsContent: TextContent[] = [];

  if (!buildLogs.isEmpty()) {
    const rawLogs = ["=== BUILD PROCESS LOGS ===\n\n", ...buildLogs.readAll()];
    combinedLogsContent.push(textToToolContent(rawLogs.join("")));
  }

  if (!packageManagerLogs.isEmpty()) {
    const rawLogs = ["=== JS PACKAGER LOGS ===\n\n", ...packageManagerLogs.readAll()];
    combinedLogsContent.push(textToToolContent(rawLogs.join("")));
  }

  if (!metroLogs.isEmpty()) {
    const rawLogs = ["=== METRO LOGS ===\n\n", ...metroLogs.readAll()];
    combinedLogsContent.push(textToToolContent(rawLogs.join("")));
  }

  if (!deviceLogs.isEmpty()) {
    const rawLogs = ["=== APPLICATION LOGS ===\n\n", ...deviceLogs.readAll()];
    combinedLogsContent.push(textToToolContent(rawLogs.join("")));
  }

  if (session.previewReady) {
    const screenshot = await session.getScreenshot();
    const contents = readFileSync(screenshot.tempFileLocation, { encoding: "base64" });

    return {
      content: [...combinedLogsContent, pngToToolContent(contents)],
    };
  }

  return {
    content: combinedLogsContent,
  };
}
