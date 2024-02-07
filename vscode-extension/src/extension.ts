import {
  commands,
  languages,
  debug,
  window,
  workspace,
  Uri,
  ExtensionContext,
  ExtensionMode,
  DebugConfigurationProviderTriggerKind,
} from "vscode";
import { PreviewsPanel } from "./panels/PreviewsPanel";
import { PreviewCodeLensProvider } from "./providers/PreviewCodeLensProvider";
import { DebugConfigProvider } from "./providers/DebugConfigProvider";
import { DebugAdapterDescriptorFactory } from "./debugging/DebugAdapterDescriptorFactory";
import { Logger, enableDevModeLogging } from "./Logger";
import { setAppRootFolder, setExtensionContext } from "./utilities/extensionContext";
import { command } from "./utilities/subprocess";
import path from "path";
import os from "os";
import fs from "fs";

const BIN_MODIFICATION_DATE_KEY = "bin_modification_date";

function handleUncaughtErrors() {
  process.on("unhandledRejection", (error) => {
    Logger.error("Unhandled promise rejection", error);
  });
  process.on("uncaughtException", (error: Error) => {
    // @ts-ignore
    if (error.errno === -49) {
      // there is some weird EADDRNOTAVAIL uncaught error thrown in extension host
      // that does not seem to affect anything yet it gets reported here while not being
      // super valuable to the user – hence we ignore it.
      return;
    }
    Logger.error("Uncaught exception", error);
    Logger.openOutputPanel();
    window.showErrorMessage("Internal extension error.", "Dismiss");
  });
}

export function deactivate(context: ExtensionContext): undefined {
  commands.executeCommand("setContext", "RNIDE.extensionIsActive", false);
  return undefined;
}

export async function activate(context: ExtensionContext) {
  handleUncaughtErrors();
  setExtensionContext(context);
  if (context.extensionMode === ExtensionMode.Development) {
    enableDevModeLogging();
  }

  await fixBinaries(context);
  const appRootFolder = await findAppRootFolder(context);
  if (appRootFolder) {
    Logger.info(`Found app root folder: ${appRootFolder}`);
    setAppRootFolder(appRootFolder);
  }

  context.subscriptions.push(
    commands.registerCommand("RNIDE.openPanel", (fileName?: string, lineNumber?: number) => {
      PreviewsPanel.render(context, fileName, lineNumber);
    })
  );
  context.subscriptions.push(
    commands.registerCommand("RNIDE.showPanel", (fileName?: string, lineNumber?: number) => {
      PreviewsPanel.render(context, fileName, lineNumber);
    })
  );
  context.subscriptions.push(
    commands.registerCommand("RNIDE.diagnose", async () => {
      await diagnoseWorkspaceStructure(appRootFolder);
    })
  );

  context.subscriptions.push(
    debug.registerDebugConfigurationProvider(
      "com.swmansion.react-native-ide",
      new DebugConfigProvider(),
      DebugConfigurationProviderTriggerKind.Dynamic
    )
  );

  context.subscriptions.push(
    debug.registerDebugAdapterDescriptorFactory(
      "com.swmansion.react-native-ide",
      new DebugAdapterDescriptorFactory()
    )
  );

  context.subscriptions.push(
    languages.registerCodeLensProvider(
      [
        { scheme: "file", language: "typescriptreact" },
        { scheme: "file", language: "javascript" },
      ],
      new PreviewCodeLensProvider()
    )
  );

  if (appRootFolder) {
    commands.executeCommand("setContext", "RNIDE.extensionIsActive", true);
    PreviewsPanel.extensionActivated(context);
  }
}

async function findAppRootFolder(context: ExtensionContext) {
  const rnPackageLocations = await workspace.findFiles(
    "**/node_modules/react-native/package.json",
    null,
    2
  );
  if (rnPackageLocations.length === 1) {
    return Uri.joinPath(rnPackageLocations[0], "../../..").fsPath;
  } else if (rnPackageLocations.length > 1) {
    Logger.error("Found multiple react-native instances in the workspace");
    return undefined;
  }
  Logger.info("Could not find react-native package.json in the workspace, looking for app.json");

  const appJsonLocations = await workspace.findFiles("**/app.json", "**/node_modules", 2);
  if (appJsonLocations.length === 1) {
    return Uri.joinPath(appJsonLocations[0], "..").fsPath;
  } else if (appJsonLocations.length > 1) {
    Logger.error("Found multiple app.json files in the workspace");
    return undefined;
  }
  Logger.info(
    "Could not find react-native package.json in the workspace, looking for metro.config.js"
  );

  const metroConfigLocations = await workspace.findFiles(
    "**/metro.config.js",
    "**/node_modules",
    2
  );
  if (metroConfigLocations.length === 1) {
    return Uri.joinPath(metroConfigLocations[0], "..").fsPath;
  } else if (metroConfigLocations.length > 1) {
    Logger.error("Found multiple metro.config.js files in the workspace");
    return undefined;
  }

  return undefined;
}

async function diagnoseWorkspaceStructure(appRootFolder: string | undefined) {
  if (!appRootFolder) {
    window.showErrorMessage(
      `
      React Native IDE couldn't find root application folder in this workspace.\n
      Please make sure that the opened workspace contains a valid React Native or Expo project.\n
      The way extension verifies the project is by looking for either: app.json, metro.config.js,
      or node_modules/react-native folder`,
      "Dismiss"
    );
    return;
  }
  window
    .showInformationMessage(
      `
        Workspace structure seems to be ok.\n
        You can open the IDE Panel using the button below or from the command palette.`,
      "Open IDE Panel",
      "Cancel"
    )
    .then((item) => {
      if (item === "Open IDE Panel") {
        commands.executeCommand("RNIDE.openPanel");
      }
    });
}

async function fixBinaries(context: ExtensionContext) {
  // MacOS prevents binary files from being executed when downloaded from the internet.
  // It requires notarization ticket to be available in the package where the binary was distributed
  // with. Apparently Apple does not allow for individual binary files to be notarized and only .app/.pkg and .dmg
  // files are allows. To prevent the binary from being quarantined, we clone it to a temporary file and then
  // move it back to the original location. This way the quarantine attribute is removed.
  // We try to do it only when the binary has been modified or for new installation, we detect it based
  // on the modification date of the binary file.
  const binModiticationDate = context.globalState.get(BIN_MODIFICATION_DATE_KEY);
  const binPath = Uri.file(context.asAbsolutePath("dist/sim-controller"));
  const tmpFile = Uri.file(path.join(os.tmpdir(), "sim-controller"));

  if (binModiticationDate !== undefined) {
    const binStats = await workspace.fs.stat(binPath);
    if (binStats?.mtime === binModiticationDate) {
      return;
    }
  }

  // if the modification date is not set or the binary has been modified since copied, we clone the binary
  // using `dd` command to remove the quarantine attribute
  await command(`dd if=${binPath.fsPath} of=${tmpFile.fsPath}`);
  await workspace.fs.delete(binPath);
  await workspace.fs.rename(tmpFile, binPath);
  await fs.promises.chmod(binPath.fsPath, 0o755);

  const binStats = await workspace.fs.stat(binPath);
  context.globalState.update(BIN_MODIFICATION_DATE_KEY, binStats?.mtime);
}
