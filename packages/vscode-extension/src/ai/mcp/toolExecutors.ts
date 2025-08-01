import { readFileSync } from "fs";

import { IDE } from "../../project/ide";
import { base64ToContent, textToContent, textToToolResponse } from "./utils";
import { ToolResponse } from "./models";
import { Output } from "../../common/OutputChannel";
import { DevicePlatform } from "../../common/DeviceManager";

export async function screenshotToolExec(): Promise<ToolResponse> {
  const project = IDE.getInstanceIfExists()?.project;

  if (!project || !project.deviceSession) {
    return textToToolResponse(
      "Could not capture a screenshot!\n" +
        "The development viewport device is likely turned off.\n" +
        "Please turn on the Radon IDE emulator before proceeding."
    );
  }

  const screenshot = await project.deviceSession.captureScreenshot();

  const contents = readFileSync(screenshot.tempFileLocation, { encoding: "base64" });

  return {
    content: [base64ToContent(contents)],
  };
}

export async function buildLogsToolExec(): Promise<ToolResponse> {
  const ideInstance = IDE.getInstanceIfExists();

  const errorMessage = "Could not view the build logs! Radon IDE extension has not been opened.";

  if (!ideInstance) {
    return textToToolResponse(errorMessage);
  }

  // TODO: Check if `deviceSession` is always available during build process.

  const registry = ideInstance.outputChannelRegistry;
  const session = ideInstance.project.deviceSession;

  if (!session) {
    return textToToolResponse(errorMessage);
  }

  const isAndroid = session.platform === DevicePlatform.Android;

  const buildLogs = registry.getOrCreateOutputChannel(
    isAndroid ? Output.BuildAndroid : Output.BuildIos
  );

  const bundlerLogs = registry.getOrCreateOutputChannel(Output.PackageManager);

  const deviceLogs = registry.getOrCreateOutputChannel(
    isAndroid ? Output.AndroidDevice : Output.IosDevice
  );

  const combinedLogs = [];

  if (!buildLogs.isEmpty()) {
    combinedLogs.push("=== BUILD PROCESS STARTED ===\n", ...buildLogs.readAll());
  }

  if (!bundlerLogs.isEmpty()) {
    combinedLogs.push("\n\n=== BUNDLING PROCESS STARTED ===\n", ...bundlerLogs.readAll());
  }

  if (!deviceLogs.isEmpty()) {
    combinedLogs.push("\n\n=== APPLICATION STARTED ===\n", ...deviceLogs.readAll());
  }

  // TODO: Are `bundlerLogs` and `deviceLogs` cleared before build?
  //       ^ If not, then store timestamps of the latest build, bundle with logs of bundler if they occured after the build.

  const text = combinedLogs.join("\n");

  if (session.device.isPreviewStarted()) {
    const screenshot = await session.captureScreenshot();
    const contents = readFileSync(screenshot.tempFileLocation, { encoding: "base64" });

    return {
      content: [textToContent(text), base64ToContent(contents)],
    };
  }

  return textToToolResponse(text);
}
