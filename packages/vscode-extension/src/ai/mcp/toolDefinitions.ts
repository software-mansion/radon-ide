import { readFileSync } from "fs";

import { IDE } from "../../project/ide";
import { ToolResponse } from "./models";
import { textToToolResponse } from "./utils";

export async function screenshotToolDef(): Promise<ToolResponse> {
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
        model_config: {
          extra: "allow",
        },
      },
    ],
    isError: false,
  };
}
