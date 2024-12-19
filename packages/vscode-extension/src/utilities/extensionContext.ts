import { commands, ExtensionContext, Uri, workspace, window } from "vscode";
import { Logger } from "../Logger";
import { findFilesInWorkspace, isWorkspaceRoot } from "./common";
import { getLaunchConfiguration } from "./launchConfiguration";
import fs from "fs";
import { LaunchConfigurationOptions } from "../common/LaunchConfig";

let _extensionContext: ExtensionContext | null = null;

export function setExtensionContext(context: ExtensionContext) {
  _extensionContext = context;
}

export const extensionContext = new Proxy<ExtensionContext>({} as ExtensionContext, {
  get(target, prop) {
    if (!_extensionContext) {
      throw new Error("ExtensionContext has not been initialized");
    }
    return Reflect.get(_extensionContext, prop);
  },
});

let _appRootFolder: string | null = null;

export const getCurrentLaunchConfig = (): LaunchConfigurationOptions => {
  const launchConfiguration = workspace.getConfiguration(
    "launch",
    workspace.workspaceFolders![0].uri
  );

  const configurations = launchConfiguration.get<Array<Record<string, any>>>("configurations")!;

  const RNIDEConfiguration = configurations.find(
    ({ type }) => type === "react-native-ide" || type === "radon-ide" // for compatibility we want to support old configuration type name
  );

  if (!RNIDEConfiguration) {
    return {};
  }

  const { android, appRoot, ios, isExpo, metroConfigPath, env } = RNIDEConfiguration;

  return { android, appRoot, ios, isExpo, metroConfigPath, env };
};

export function setAppRootFolder(appRootFolder: string) {
  _appRootFolder = appRootFolder;
}

export function getAppRootFolder() {
  if (!_appRootFolder) {
    throw new Error("App root folder has not been set");
  }
  return _appRootFolder;
}

export async function configureAppRootFolder() {
  const appRootFolder = await findAppRootFolder();
  if (appRootFolder) {
    Logger.info(`Found app root folder: ${appRootFolder}`);
    setAppRootFolder(appRootFolder);
    commands.executeCommand("setContext", "RNIDE.extensionIsActive", true);
  }
  return appRootFolder;
}

export async function findAppRootCandidates(): Promise<string[]> {
  const candidates: string[] = [];

  const metroConfigUris = await findFilesInWorkspace("**/metro.config.{js,ts}", "**/node_modules");
  metroConfigUris.forEach((metroConfigUri) => {
    candidates.push(Uri.joinPath(metroConfigUri, "..").fsPath);
  });

  const appConfigUris = await findFilesInWorkspace("**/app.config.{js,ts}", "**/node_modules");
  appConfigUris.forEach((appConfigUri) => {
    const appRootFsPath = Uri.joinPath(appConfigUri, "..").fsPath;
    if (!candidates.includes(appRootFsPath)) {
      candidates.push(appRootFsPath);
    }
  });

  // given that if the user uses workspaces his node_modules are installed not in the root of an application,
  // but in the root of the workspace we need to detect workspaces root and exclude it.
  let excludePattern = null;
  workspace.workspaceFolders?.forEach((folder) => {
    if (isWorkspaceRoot(folder.uri.fsPath)) {
      excludePattern = "node_modules/react-native/package.json";
    }
  });

  const rnPackageLocations = await findFilesInWorkspace(
    "**/node_modules/react-native/package.json",
    excludePattern
  );
  rnPackageLocations.forEach((rnPackageLocation) => {
    const appRootFsPath = Uri.joinPath(rnPackageLocation, "../../..").fsPath;
    if (!candidates.includes(appRootFsPath)) {
      candidates.push(appRootFsPath);
    }
  });

  // app json is often used in non react-native projects, but in worst case scenario we can use it as a fallback
  const appJsonUris = await findFilesInWorkspace("**/app.json", "**/node_modules");
  appJsonUris.forEach((appJsonUri) => {
    const appRootFsPath = Uri.joinPath(appJsonUri, "..").fsPath;
    if (!candidates.includes(appRootFsPath)) {
      candidates.push(appRootFsPath);
    }
  });

  return candidates;
}

async function findAppRootFolder() {
  const launchConfiguration = getLaunchConfiguration();
  const appRootFromLaunchConfig = launchConfiguration.appRoot;
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

  const appRootCandidates = await findAppRootCandidates();

  if (appRootCandidates.length > 1) {
    const openLaunchConfigButton = "Open Launch Configuration";
    window
      .showWarningMessage(
        `Multiple react-native applications were detected in the workspace. "${appRootCandidates[0]}" was automatically chosen as your application root. To change that or remove this warning in the future, you can setup a permanent appRoot in Launch Configuration.`,
        openLaunchConfigButton
      )
      .then((item) => {
        if (item === openLaunchConfigButton) {
          commands.executeCommand("workbench.action.debug.configure");
        }
      });
  }

  if (appRootCandidates.length > 0) {
    return appRootCandidates[0];
  }

  const manageLaunchConfigButton = "Manage Launch Configuration";
  window
    .showErrorMessage(
      `
    Radon IDE couldn't find root application folder in this workspace.\n
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
