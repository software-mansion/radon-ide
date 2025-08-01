import { readFileSync } from "fs";

import { IDE } from "../../project/ide";
import { textToToolResponse } from "./utils";
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
    content: [
      {
        type: "image",
        data: contents,
        mimeType: "image/png",
      },
    ],
  };
}

export async function buildLogsToolExec(): Promise<ToolResponse> {
  const ideInstance = IDE.getInstanceIfExists();

  if (!ideInstance) {
    return textToToolResponse(
      "Could not view the build logs! Radon IDE extension has not been opened."
    );
  }

  // TODO: Check if `deviceSession` is always available during build process.

  const registry = ideInstance.outputChannelRegistry;
  const session = ideInstance.project.deviceSession;

  if (!session) {
    return textToToolResponse(
      "Could not view the build & bundler logs! Device session has not been started."
    );
  }

  // TODO: Store logs, timestamps of the latest build, bundle with logs of bundler if they occured after the build.

  const isAndroid = session.platform === DevicePlatform.Android;

  const buildLogs = registry.getOrCreateOutputChannel(
    isAndroid ? Output.BuildAndroid : Output.BuildIos
  );

  const bundlerLogs = registry.getOrCreateOutputChannel(Output.PackageManager);

  const deviceLogs = registry.getOrCreateOutputChannel(
    isAndroid ? Output.AndroidDevice : Output.IosDevice
  );

  // TODO: Only show the device and bundler logs if previous steps succeeded
  //       ^ Adding timestamps to all logs will make this easy.

  const combinedLogs = [
    "=== BUILD PROCESS STARTED ===",
    ...buildLogs.readAll(),
    "=== BUNDLER LOGS ===",
    ...bundlerLogs.readAll(),
    "=== DEVICE LOGS ===",
    ...deviceLogs.readAll(),
  ];

  // (deviceLogs.length ? ...deviceLogs.readAll() : 'ZERO DEVICE LOGS')

  const text = combinedLogs.join("\n");

  return textToToolResponse(text);
}
