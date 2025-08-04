import { readFileSync } from "fs";

import { IDE } from "../../project/ide";
import {
  base64ToToolContent,
  textToToolContent,
  textToToolResponse,
  truncateMiddle,
} from "./utils";
import { ToolResponse } from "./models";
import { Output } from "../../common/OutputChannel";
import { DevicePlatform } from "../../common/DeviceManager";
import { DeviceRotation } from "../../common/Project";

// Some builds churn out +45k lines of logs.
// We're only interested in the first 50 and last 150 of them.
// These numbers are arbitriary and work well.
const KEEP_FIRST_N = 50;
const KEEP_LAST_N = 150;

export async function screenshotToolExec(): Promise<ToolResponse> {
  const project = IDE.getInstanceIfExists()?.project;

  if (!project || !project.deviceSession) {
    return textToToolResponse(
      "Could not capture a screenshot!\n" +
        "The development viewport device is likely turned off.\n" +
        "Please turn on the Radon IDE emulator before proceeding."
    );
  }

  const screenshot = await project.deviceSession.captureScreenshot(project.getDeviceRotation());

  const contents = readFileSync(screenshot.tempFileLocation, { encoding: "base64" });

  return {
    content: [base64ToToolContent(contents)],
  };
}

export async function buildLogsToolExec(): Promise<ToolResponse> {
  const ideInstance = IDE.getInstanceIfExists();

  const errorMessage = "Could not view the build logs! Radon IDE extension has not been opened.";

  if (!ideInstance) {
    return textToToolResponse(errorMessage);
  }

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
    const truncated = truncateMiddle(buildLogs.readAll(), KEEP_FIRST_N, KEEP_LAST_N);
    combinedLogs.push("=== BUILD PROCESS STARTED ===\n", ...truncated);
  }

  if (!bundlerLogs.isEmpty()) {
    const truncated = truncateMiddle(bundlerLogs.readAll(), KEEP_FIRST_N, KEEP_LAST_N);
    combinedLogs.push("\n\n=== BUNDLING PROCESS STARTED ===\n", ...truncated);
  }

  if (!deviceLogs.isEmpty()) {
    const truncated = truncateMiddle(deviceLogs.readAll(), KEEP_FIRST_N, KEEP_LAST_N);
    combinedLogs.push("\n\n=== APPLICATION STARTED ===\n", ...truncated);
  }

  // TODO: Are `bundlerLogs` and `deviceLogs` cleared before build?
  //       ^ If not, then store timestamps of the latest build, bundle with logs of bundler if they occured after the build.

  const text = combinedLogs.join("");

  if (session.previewReady) {
    const screenshot = await session.captureScreenshot(DeviceRotation.Portrait);
    const contents = readFileSync(screenshot.tempFileLocation, { encoding: "base64" });

    return {
      content: [textToToolContent(text), base64ToToolContent(contents)],
    };
  }

  return textToToolResponse(text);
}
