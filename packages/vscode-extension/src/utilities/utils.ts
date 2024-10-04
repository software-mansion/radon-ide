import { homedir } from "node:os";
import fs from "fs";
import path from "path";
import JSON5 from "json5";
import { commands, window, env, Uri } from "vscode";
import vscode from "vscode";
import { Logger } from "../Logger";
import { extensionContext } from "./extensionContext";
import { openFileAtPosition } from "./openFileAtPosition";
import { UtilsInterface } from "../common/utils";
import { Platform } from "./platform";

type KeybindingType = {
  command: string;
  key?: string;
  mac?: string;
  when?: string;
};

export class Utils implements UtilsInterface {
  public async getCommandsCurrentKeyBinding(commandName: string) {
    const packageJsonPath = path.join(extensionContext.extensionPath, "package.json");
    const extensionPackageJson = require(packageJsonPath);
    const ideName = vscode.env.appName.includes("Cursor") ? "Cursor" : "Code";
    let keybindingsJsonPath;
    let keybindingsJson;
    try {
      keybindingsJsonPath = path.join(
        homedir(),
        Platform.select({
          macos: path.join("Library", "Application Support"),
          windows: path.join("AppDat", "Roaming"),
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

  async reportIssue() {
    env.openExternal(Uri.parse("https://github.com/software-mansion/radon-ide/issues/new/choose"));
  }

  public async openFileAt(filePath: string, line0Based: number, column0Based: number) {
    openFileAtPosition(filePath, line0Based, column0Based);
  }

  public async movePanelToNewWindow() {
    commands.executeCommand("workbench.action.moveEditorToNewWindow");
  }

  public async showDismissableError(errorMessage: string) {
    window.showErrorMessage(errorMessage, "Dismiss");
  }

  public async openExternalUrl(uriString: string) {
    env.openExternal(Uri.parse(uriString));
  }
}
