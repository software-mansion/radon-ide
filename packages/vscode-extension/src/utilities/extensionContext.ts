import { ExtensionContext } from "vscode";
import { LaunchConfigurationOptions } from "./launchConfiguration";
import fs from "fs";
import { Logger } from "../Logger";

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

export function setAppRootFolder(appRootFolder: string) {
  _appRootFolder = appRootFolder;
}

export function getAppRootFolder() {
  if (!_appRootFolder) {
    throw new Error("App root folder has not been set");
  }
  return _appRootFolder;
}
