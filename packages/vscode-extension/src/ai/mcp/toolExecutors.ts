import { readFileSync } from "fs";

import { IDE } from "../../project/ide";
import { pngToToolContent, textToToolContent, textToToolResponse } from "./utils";
import { TextContent, ToolResponse } from "./models";
import { Output } from "../../common/OutputChannel";
import { DevicePlatform } from "../../common/State";
import prettyPrintComponentTree from "./printComponentTree";

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

export async function viewComponentTreeExec(): Promise<ToolResponse> {
  const project = IDE.getInstanceIfExists()?.project;

  if (!project?.deviceSession) {
    return textToToolResponse(
      "Could not extract a component tree from the app, the app is not running!\n" +
        "The development device is likely turned off.\n" +
        "Please turn on the Radon IDE emulator before proceeding."
    );
  }

  const store = project.deviceSession.devtoolsStore;

  if (!store) {
    return textToToolResponse(
      "Could not extract a component tree from the app, the devtools are not accessible!\n" +
        "Are you sure an application is running on the development device?\n" +
        "Please launch the app on the Radon IDE emulator before proceeding."
    );
  }

  const repr = prettyPrintComponentTree(store);

  return textToToolResponse(repr);
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
