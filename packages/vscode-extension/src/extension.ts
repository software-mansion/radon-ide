import {
  commands,
  languages,
  debug,
  window,
  workspace,
  Uri,
  ExtensionContext,
  ExtensionMode,
  ConfigurationChangeEvent,
  DebugConfigurationProviderTriggerKind,
} from "vscode";
import { TabPanel } from "./panels/Tabpanel";
import { PreviewCodeLensProvider } from "./providers/PreviewCodeLensProvider";
import { DebugConfigProvider } from "./providers/DebugConfigProvider";
import { DebugAdapterDescriptorFactory } from "./debugging/DebugAdapterDescriptorFactory";
import { Logger, enableDevModeLogging } from "./Logger";
import {
  extensionContext,
  setAppRootFolder,
  setExtensionContext,
} from "./utilities/extensionContext";
import { command } from "./utilities/subprocess";
import path from "path";
import os from "os";
import fs from "fs";
import { SidePanelViewProvider } from "./panels/SidepanelViewProvider";
import { PanelLocation } from "./common/WorkspaceConfig";
import { getLaunchConfiguration } from "./utilities/launchConfiguration";
import { getTelemetryReporter } from "./utilities/telemetry";

const BIN_MODIFICATION_DATE_KEY = "bin_modification_date";
const OPEN_PANEL_ON_ACTIVATION = "open_panel_on_activation";

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
  TabPanel.currentPanel?.dispose();
  SidePanelViewProvider.currentProvider?.dispose();
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

  async function showIDEPanel(fileName?: string, lineNumber?: number) {
    const panelLocation = workspace
      .getConfiguration("ReactNativeIDE")
      .get<PanelLocation>("panelLocation");

    if (panelLocation !== "tab") {
      SidePanelViewProvider.showView(context, fileName, lineNumber);
    } else {
      TabPanel.render(context, fileName, lineNumber);
    }
  }

  context.subscriptions.push(
    window.registerWebviewViewProvider(
      SidePanelViewProvider.viewType,
      new SidePanelViewProvider(context),
      { webviewOptions: { retainContextWhenHidden: true } }
    )
  );
  context.subscriptions.push(commands.registerCommand("RNIDE.openPanel", showIDEPanel));
  context.subscriptions.push(commands.registerCommand("RNIDE.showPanel", showIDEPanel));
  context.subscriptions.push(
    commands.registerCommand("RNIDE.diagnose", diagnoseWorkspaceStructure)
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

  context.subscriptions.push(
    workspace.onDidChangeConfiguration((event: ConfigurationChangeEvent) => {
      if (event.affectsConfiguration("ReactNativeIDE.panelLocation")) {
        showIDEPanel();
      }
    })
  );

  await configureAppRootFolder();
}

async function findSingleFileInWorkspace(fileGlobPattern: string, excludePattern: string | null) {
  const files = await workspace.findFiles(fileGlobPattern, excludePattern, 2);
  if (files.length === 1) {
    return files[0];
  } else if (files.length > 1) {
    Logger.error(`Found multiple ${fileGlobPattern} files in the workspace`);
  }
  return undefined;
}

function extensionActivated() {
  if (extensionContext.workspaceState.get(OPEN_PANEL_ON_ACTIVATION)) {
    commands.executeCommand("RNIDE.openPanel");
  }
}

async function configureAppRootFolder() {
  const appRootFolder = await findAppRootFolder();
  if (appRootFolder) {
    Logger.info(`Found app root folder: ${appRootFolder}`);
    setAppRootFolder(appRootFolder);
    commands.executeCommand("setContext", "RNIDE.extensionIsActive", true);
    extensionActivated();
  }
  return appRootFolder;
}

async function findAppRootFolder() {
  const appRootFromLaunchConfig = getLaunchConfiguration().appRoot;
  if (appRootFromLaunchConfig) {
    let appRoot: string | undefined;
    workspace.workspaceFolders?.forEach((folder) => {
      const possibleAppRoot = Uri.joinPath(folder.uri, appRootFromLaunchConfig).fsPath;
      if (fs.existsSync(possibleAppRoot)) {
        appRoot = possibleAppRoot;
      }
    });
    if (!appRoot) {
      // when relative app location setting is set, we expect app root exists
      const openLaunchConfigButton = "Open Launch Configuration";
      window
        .showErrorMessage(
          `The app root folder does not exist in the workspace at ${appRootFromLaunchConfig}.`,
          openLaunchConfigButton
        )
        .then((item) => {
          if (item === openLaunchConfigButton) {
            commands.executeCommand("workbench.action.debug.configure");
          }
        });
      return undefined;
    }
    return appRoot;
  }

  const metroConfigUri = await findSingleFileInWorkspace(
    "**/metro.config.{js,ts}",
    "**/node_modules"
  );
  if (metroConfigUri) {
    return Uri.joinPath(metroConfigUri, "..").fsPath;
  }

  const appConfigUri = await findSingleFileInWorkspace("**/app.config.{js,ts}", "**/node_modules");
  if (appConfigUri) {
    return Uri.joinPath(appConfigUri, "..").fsPath;
  }

  const rnPackageLocation = await findSingleFileInWorkspace(
    "**/node_modules/react-native/package.json",
    null
  );
  if (rnPackageLocation) {
    return Uri.joinPath(rnPackageLocation, "../../..").fsPath;
  }

  // app json is often used in non react-native projects, but in worst case scenario we can use it as a fallback
  const appJsonUri = await findSingleFileInWorkspace("**/app.json", "**/node_modules");
  if (appJsonUri) {
    return Uri.joinPath(appJsonUri, "..").fsPath;
  }

  const manageLaunchConfigButton = "Manage Launch Configuration";
  window
    .showErrorMessage(
      `
    React Native IDE couldn't find root application folder in this workspace.\n
    Please make sure that the opened workspace contains a valid React Native or Expo project.\n
    The way extension verifies the project is by looking for either: app.json, metro.config.js,
    or node_modules/react-native folder. If your project structure is different, you can set the
    app root using launch configuration.`,
      manageLaunchConfigButton,
      "Dismiss"
    )
    .then((item) => {
      if (item === manageLaunchConfigButton) {
        commands.executeCommand("debug.addConfiguration");
      }
    });
  return undefined;
}

async function diagnoseWorkspaceStructure() {
  const appRootFolder = await configureAppRootFolder();
  if (appRootFolder) {
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
  const binPath = Uri.file(context.asAbsolutePath("dist/sim-server"));
  const tmpFile = Uri.file(path.join(os.tmpdir(), "sim-server"));

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
