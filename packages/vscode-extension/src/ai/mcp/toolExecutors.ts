import { readFileSync } from "fs";

import { IDE } from "../../project/ide";
import { textToToolResponse } from "./utils";
import { ToolResponse } from "./models";
import { Output } from "../../common/OutputChannel";

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
  const registry = IDE.getInstanceIfExists()?.outputChannelRegistry;

  if (!registry) {
    return textToToolResponse(
      "Could not view the build logs! Radon IDE extension has not been opened."
    );
  }

  // TODO: Combine latest logs for both iOS, Android, and Bundler.
  // TODO: Only serve the latest build.
  // TODO: Make Output.AndroidDevice and Output.IosDevice logs available. Perhaps show them instead  if the build succeeded?

  const log = registry.getOrCreateOutputChannel(Output.BuildAndroid);
  const text = log.readAll().join("\n");

  return textToToolResponse(text);
}
