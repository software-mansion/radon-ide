import fs from "fs";
import path from "path";
import { commands, ExtensionContext, Uri, workspace, window } from "vscode";
import { Logger } from "../Logger";
import { getLaunchConfiguration } from "./launchConfiguration";
import { LaunchConfigurationOptions } from "../common/LaunchConfig";

let _extensionContext: ExtensionContext | null = null;

type SearchItem = { path: string; searchDepth: number };

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

export function findAppRootCandidates(maxSearchDepth: number = 3): string[] {
  const searchedFileNames = [
    "metro.config.js",
    "metro.config.ts",
    "app.json",
    "app.config.js",
    "app.config.ts",
  ];

  // In order to optimize the search time we exclude directories,
  // that shouldn't contain applications.
  const excludedDirectoryPatterns: RegExp[] = [/^node_modules$/, /^ios$/, /^android$/, /^\..+/];

  const workspaceFolders = workspace.workspaceFolders;

  if (workspaceFolders === undefined) {
    Logger.warn("[FindFiles] Could not determine active workspace");
    return [];
  }

  const searchDirectories: SearchItem[] = workspaceFolders.map((workspaceFolder) => {
    return { path: workspaceFolder.uri.fsPath, searchDepth: 0 };
  });

  const candidates = searchForFilesDirectory(
    searchedFileNames,
    searchDirectories,
    excludedDirectoryPatterns,
    maxSearchDepth
  );

  if (candidates.length > 1) {
    Logger.debug(
      `Found multiple directories containing one or more of ${searchedFileNames} files in the workspace`
    );
  }

  return candidates;
}

function searchForFilesDirectory(
  searchedFileNames: string[],
  searchDirectories: SearchItem[],
  excludedDirectoryPatterns: RegExp[],
  maxDepth: number
) {
  const results: string[] = [];

  const searchQueue: SearchItem[] = searchDirectories;

  while (searchQueue.length > 0) {
    const currentDir = searchQueue.shift()!;

    if (currentDir.searchDepth > maxDepth) {
      break;
    }

    const filesAndDirs = fs.readdirSync(currentDir.path.toString(), { withFileTypes: true });

    const isCandidate = filesAndDirs.some((dirEntry) => {
      return dirEntry.isFile() && searchedFileNames.includes(dirEntry.name);
    });

    if (isCandidate) {
      results.push(currentDir.path);
    }

    filesAndDirs
      .filter((dirEntry) => {
        return (
          !dirEntry.isFile() &&
          !excludedDirectoryPatterns.some((pattern) => pattern.test(dirEntry.name))
        );
      })
      .forEach((dir) => {
        searchQueue.push({
          path: path.join(currentDir.path, dir.name),
          searchDepth: currentDir.searchDepth + 1,
        });
      });
  }

  return results;
}

export function findAppRootFolder() {
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

  const appRootCandidates = findAppRootCandidates();

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
