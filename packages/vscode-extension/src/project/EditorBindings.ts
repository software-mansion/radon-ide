import fs from "fs";
import { commands, window, env, Uri, ProgressLocation } from "vscode";
import JSON5 from "json5";
import path from "path";
import { homedir } from "os";
import { openFileAtPosition } from "../utilities/openFileAtPosition";
import { Logger } from "../Logger";
import { Platform } from "../utilities/platform";
import { extensionContext } from "../utilities/extensionContext";
import { IDEPanelMoveTarget } from "../common/Project";

type KeybindingType = {
  command: string;
  key?: string;
  mac?: string;
  when?: string;
};

export class EditorBindings {
  public async getCommandsCurrentKeyBinding(commandName: string) {
    const packageJsonPath = path.join(extensionContext.extensionPath, "package.json");
    const extensionPackageJson = require(packageJsonPath);
    const ideName = env.appName.includes("Cursor") ? "Cursor" : "Code";
    let keybindingsJsonPath;
    let keybindingsJson;
    try {
      keybindingsJsonPath = path.join(
        homedir(),
        Platform.select({
          macos: path.join("Library", "Application Support"),
          windows: path.join("AppData", "Roaming"),
          linux: path.join(".config"),
        }),
        ideName,
        "User",
        "keybindings.json"
      );
      // cannot use require because the file may contain comments
      keybindingsJson = JSON5.parse(fs.readFileSync(keybindingsJsonPath).toString());
    } catch (e) {
      Logger.error("Error while parsing keybindings.json", e);
      return undefined;
    }

    const isRNIDECommand =
      !!extensionPackageJson.contributes.commands &&
      !!extensionPackageJson.contributes.commands.find((command: KeybindingType) => {
        return command.command === commandName;
      });
    if (!isRNIDECommand) {
      Logger.warn("Trying to access a keybinding for a command that is not part of an extension.");
      return undefined;
    }

    const userKeybinding = keybindingsJson.find((command: KeybindingType) => {
      return command.command === commandName;
    });
    if (userKeybinding) {
      return userKeybinding.key;
    }

    const defaultKeybinding = extensionPackageJson.contributes.keybindings.find(
      (keybinding: KeybindingType) => {
        return keybinding.command === commandName;
      }
    );
    if (defaultKeybinding) {
      return defaultKeybinding.mac;
    }

    return undefined;
  }

  public async openFileAt(filePath: string, line0Based: number, column0Based: number) {
    openFileAtPosition(filePath, line0Based, column0Based);
  }

  public async movePanelTo(location: IDEPanelMoveTarget) {
    commands.executeCommand("RNIDE.showPanel", location);
  }

  public async openExternalUrl(uriString: string) {
    env.openExternal(Uri.parse(uriString));
  }

  public async showDismissableError(errorMessage: string) {
    window.showErrorMessage(errorMessage, "Dismiss");
  }

  async showToast(message: string, timeout: number) {
    // VSCode doesn't support auto hiding notifications, so we use a workaround with progress
    await window.withProgress(
      {
        location: ProgressLocation.Notification,
        cancellable: false,
      },
      async (progress) => {
        progress.report({ message, increment: 100 });
        await new Promise((resolve) => setTimeout(resolve, timeout));
      }
    );
  }
}
