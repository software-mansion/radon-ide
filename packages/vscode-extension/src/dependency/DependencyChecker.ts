import { Webview, Disposable } from "vscode";
import { Logger } from "../Logger";
import fs from "fs";
import { EMULATOR_BINARY } from "../devices/AndroidEmulatorDevice";
import { command } from "../utilities/subprocess";
import path from "path";
import { getIosSourceDir } from "../builders/buildIOS";
import { getAppRootFolder } from "../utilities/extensionContext";

export class DependencyChecker implements Disposable {
  private disposables: Disposable[] = [];

  constructor(private readonly webview: Webview) {}

  public dispose() {
    // Dispose of all disposables (i.e. commands) for the current webview panel
    while (this.disposables.length) {
      const disposable = this.disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }

  public setWebviewMessageListener() {
    Logger.debug("Setup dependency checker listeners.");
    this.webview.onDidReceiveMessage(
      (message: any) => {
        const command = message.command;
        switch (command) {
          case "checkNodejsInstalled":
            Logger.debug("Received checkNodejsInstalled command.");
            this.checkNodejsInstalled();
            return;
          case "checkAndroidEmulatorInstalled":
            Logger.debug("Received checkAndroidEmulatorInstalled command.");
            this.checkAndroidEmulatorInstalled();
            return;
          case "checkXcodeInstalled":
            Logger.debug("Received checkXcodeInstalled command.");
            this.checkXcodeInstalled();
            return;
          case "checkCocoaPodsInstalled":
            Logger.debug("Received checkCocoaPodsInstalled command.");
            this.checkCocoaPodsInstalled();
            return;
          case "checkNodeModulesInstalled":
            Logger.debug("Received checkNodeModulesInstalled command.");
            this.checkNodeModulesInstalled();
            return;
          case "checkPodsInstalled":
            Logger.debug("Received checkPodsInstalled command.");
            this.checkPodsInstalled();
            return;
        }
      },
      undefined,
      this.disposables
    );
  }

  /* Node-related */
  public async checkNodejsInstalled() {
    const installed = await checkIfCLIInstalled("node -v");
    const errorMessage =
      "Node.js was not found. Make sure to [install Node.js](https://nodejs.org/en).";
    this.webview.postMessage({
      command: "isNodejsInstalled",
      data: {
        installed,
        info: "Used for running scripts and getting dependencies.",
        error: installed ? undefined : errorMessage,
      },
    });
    Logger.debug("Nodejs installed: ", installed);
    return installed;
  }

  public async checkNodeModulesInstalled() {
    const installed = await checkIfCLIInstalled(`npm list --json`, {
      cwd: getAppRootFolder(),
    });

    const errorMessage = "Node modules are not installed.";
    this.webview.postMessage({
      command: "isNodeModulesInstalled",
      data: {
        installed,
        info: "Whether JavaScript packages are installed.",
        error: installed ? undefined : errorMessage,
      },
    });
    Logger.debug("Node modules installed: ", installed);
    return installed;
  }

  /* Android-related */
  public async checkAndroidEmulatorInstalled() {
    const installed = await checkAndroidEmulatorExists();
    const errorMessage =
      "Android Emulator was not found. Make sure to [install Android Emulator](https://developer.android.com/studio/run/managing-avds).";
    this.webview.postMessage({
      command: "isAndroidEmulatorInstalled",
      data: {
        installed,
        info: "Used for running Android apps.",
        error: installed ? undefined : errorMessage,
      },
    });
    Logger.debug("Android Emulator installed: ", installed);
    return installed;
  }

  /* iOS-related */
  public async checkXcodeInstalled() {
    const isXcodebuildInstalled = await checkIfCLIInstalled("xcodebuild -version");
    const isXcrunInstalled = await checkIfCLIInstalled("xcrun --version");
    const isSimctlInstalled = await checkIfCLIInstalled("xcrun simctl help");
    const installed = isXcodebuildInstalled && isXcrunInstalled && isSimctlInstalled;
    const errorMessage =
      "Xcode was not found. [Install Xcode from the Mac App Store](https://apps.apple.com/us/app/xcode/id497799835?mt=12) and have Xcode Command Line Tools enabled.";
    this.webview.postMessage({
      command: "isXcodeInstalled",
      data: {
        installed,
        info: "Used for building and running iOS apps.",
        error: installed ? undefined : errorMessage,
      },
    });
    Logger.debug("Xcode Command Line Tools installed: ", installed);
    return installed;
  }

  public async checkCocoaPodsInstalled() {
    const installed = await checkIfCLIInstalled("pod --version", {
      env: { ...process.env, LANG: "en_US.UTF-8" },
    });
    const errorMessage =
      "CocoaPods was not found. Make sure to [install CocoaPods](https://guides.cocoapods.org/using/getting-started.html).";
    this.webview.postMessage({
      command: "isCocoaPodsInstalled",
      data: {
        installed,
        info: "Used for installing iOS dependencies.",
        error: installed ? undefined : errorMessage,
      },
    });
    Logger.debug("CocoaPods installed: ", installed);
    return installed;
  }

  public async checkPodsInstalled() {
    const installed = await checkIosDependenciesInstalled();
    const nodeModulesInstalled = await this.checkNodeModulesInstalled();
    const errorMessage = "iOS dependencies are not installed.";
    const extraInfoMessage = nodeModulesInstalled
      ? ""
      : "  Node modules need to be installed first.";

    this.webview.postMessage({
      command: "isPodsInstalled",
      data: {
        installed,
        info: `Whether iOS dependencies are installed.${extraInfoMessage}`,
        error: installed ? undefined : errorMessage,
      },
    });
    Logger.debug("Project pods installed: ", installed);
    return installed;
  }
}

export async function checkIfCLIInstalled(cmd: string, options: Record<string, unknown> = {}) {
  try {
    // We are not checking the stderr here, because some of the CLIs put the warnings there.
    const { stdout } = await command(cmd, { encoding: "utf8", ...options });
    return !!stdout.length;
  } catch (_) {
    return false;
  }
}

export async function checkIosDependenciesInstalled() {
  const iosDirPath = getIosSourceDir(getAppRootFolder());

  Logger.debug(`Check pods in ${iosDirPath} ${getAppRootFolder()}`);
  if (!iosDirPath) {
    return false;
  }

  const podfileLockExists = fs.existsSync(path.join(iosDirPath, "Podfile.lock"));
  const podsDirExists = fs.existsSync(path.join(iosDirPath, "Pods"));

  return podfileLockExists && podsDirExists;
}

export async function checkAndroidEmulatorExists() {
  return fs.existsSync(EMULATOR_BINARY);
}
