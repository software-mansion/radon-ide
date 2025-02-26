import fs from "fs";
import { commands, ExtensionContext, Uri, workspace, window, Disposable } from "vscode";
import { Logger } from "../Logger";
import { getLaunchConfiguration } from "./launchConfiguration";
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

export class AppRootFolder {
  private onChangeAppRootListeners: Array<(newAppRoot: string) => void> = [];

  constructor(private appRoot: string) {}

  onChangeAppRoot(listener: (newAppRoot: string) => void): Disposable {
    this.onChangeAppRootListeners.push(listener);
    return {
      dispose: () => {
        const index = this.onChangeAppRootListeners.indexOf(listener);
        if (index > -1) {
          this.onChangeAppRootListeners.splice(index, 1);
        }
      },
    };
  }

  getAppRoot(): string {
    if (!this.appRoot) {
      throw new Error("App root not set.");
    }
    return this.appRoot;
  }

  setAppRoot(newAppRoot: string): void {
    this.appRoot = newAppRoot;
    this.onChangeAppRootListeners.forEach((listener) => {
      listener(newAppRoot);
    });
    Logger.debug(`App root was set to: ${this.appRoot}.`);
  }
}

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
  const candidates: string[] = [];
  const searchedFileNames = ["metro.config.js", "app.json", "app.config.js"];

  // In order to optimize the search time we exclude directories,
  // that shouldn't contain applications.
  const excludedDirectories = ["node_modules", "ios", "android", ".git", ".yarn", ".pnpm"];

  const workspacePath = workspace.workspaceFolders?.[0];

  if (workspacePath === undefined) {
    Logger.warn("[FindFiles] Could not determine active workspace");
    return [];
  }

  const searchQueue: [string, number][] = [];
  let currentDir: [string, number] | undefined = [workspacePath.uri.path, 0];
  while (currentDir !== undefined) {
    if (currentDir[1] > maxSearchDepth) {
      break;
    }

    const filesAndDirs = fs.readdirSync(currentDir[0].toString(), { withFileTypes: true });

    let matched = false;

    filesAndDirs.forEach((dirEntry) => {
      if (dirEntry.isFile()) {
        if (!matched && searchedFileNames.includes(dirEntry.name)) {
          candidates.push(currentDir![0]);
          matched = true;
        }
        return;
      }

      if (excludedDirectories.includes(dirEntry.name)) {
        return;
      }

      searchQueue.push([currentDir![0] + "/" + dirEntry.name, currentDir![1] + 1]);
    });
    currentDir = searchQueue.shift();
  }

  if (candidates.length > 1) {
    Logger.warn(
      `Found multiple directories containing one or more of ${searchedFileNames} files in the workspace`
    );
  }

  return candidates;
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
