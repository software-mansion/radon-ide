import { readFileSync } from "fs";

import { IDE } from "../../project/ide";
import { pngToToolContent, textToToolContent, textToToolResponse } from "./utils";
import { TextContent, ToolResponse } from "./models";
import { Output } from "../../common/OutputChannel";
import { DevicePlatform } from "../../common/State";
import { printStore, Store, Element } from "../../../third-party/react-devtools/headless";

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

function printElement(element: Element) {
  return "  ".repeat(element.depth) + `<${element.displayName}>\n`;
}

function printComponentTree(store: Store) {
  const rootID = store.roots[0];
  const root = store.getElementByID(rootID) as unknown as Element;

  if (!root) {
    return "Component tree is corrupted. The component tree doesn't contain any tree roots.";
  }

  const weight = root.weight;
  let output = "";

  // TODO: Form a tree such that it's easier to cut out parts of it while preserving indentation
  for (let i = 0; i < weight; i++) {
    const element = store.getElementAtIndex(i) as unknown as Element;

    if (!element) {
      console.log(`Component tree is corrupted. Element at index ${i} not found`);
      continue;
    }

    if (element.isCollapsed) {
      store.toggleIsCollapsed(element.id, false);
    }

    output += printElement(element);
  }

  return output;
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
      "Could not extract a component tree from the app, the devtools are not accessible!\n"
      // TODO: Actionable description
    );
  }

  const _repr = printStore(store);
  const _repr2 = printComponentTree(store);

  return textToToolResponse(_repr2);
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
