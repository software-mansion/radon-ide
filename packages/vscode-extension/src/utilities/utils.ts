import { homedir } from "node:os";
import fs from "fs";
import path from "path";
import { commands, env, Uri, window } from "vscode";
import JSON5 from "json5";
import vscode from "vscode";
import { Logger } from "../Logger";
import { extensionContext } from "./extensionContext";
import { openFileAtPosition } from "./openFileAtPosition";
import { UtilsInterface } from "../common/utils";
import { Platform } from "./platform";
import { RecordingData } from "../common/Project";

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

  async reportIssue() {
    env.openExternal(Uri.parse("https://github.com/software-mansion/radon-ide/issues/new/choose"));
  }

  public async openFileAt(filePath: string, line0Based: number, column0Based: number) {
    openFileAtPosition(filePath, line0Based, column0Based);
  }

  public async saveVideoRecording(recordingData: RecordingData) {
    const extension = path.extname(recordingData.tempFileLocation);
    const timestamp = this.getTimestamp();
    const baseFileName = recordingData.fileName.substring(
      0,
      recordingData.fileName.length - extension.length
    );
    const newFileName = `${baseFileName} ${timestamp}${extension}`;
    const defaultFolder = Platform.select({
      macos: path.join(homedir(), "Desktop"),
      windows: homedir(),
      linux: homedir(),
    });
    const defaultUri = Uri.file(path.join(defaultFolder, newFileName));

    // save dialog open the location dialog, it also warns the user if the file already exists
    let saveUri = await window.showSaveDialog({
      defaultUri: defaultUri,
      filters: {
        "Video Files": [extension],
      },
    });

    if (!saveUri) {
      return false;
    }

    await fs.promises.copyFile(recordingData.tempFileLocation, saveUri.fsPath);
    return true;
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

  public async log(type: "info" | "error" | "warn" | "log", message: string, ...args: any[]) {
    Logger[type]("[WEBVIEW LOG]", message, ...args);
  }

  private getTimestamp() {
    // e.g. "2024-11-19 at 12.08.09"
    const now = new Date();

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0"); // Months are 0-indexed, so add 1
    const day = String(now.getDate()).padStart(2, "0");
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const seconds = String(now.getSeconds()).padStart(2, "0");

    // Combine into the desired format
    return `${year}-${month}-${day} ${hours}.${minutes}.${seconds}`;
  }
}
