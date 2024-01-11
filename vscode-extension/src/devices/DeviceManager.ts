import { Webview } from "vscode";
import { Logger } from "../Logger";
import {
  AndroidImageEntry,
  getAndroidSystemImages,
  installSystemImages,
  removeSystemImages,
} from "../utilities/sdkmanager";
import { RuntimeInfo, removeIosRuntimes, removeIosSimulator } from "./IosSimulatorDevice";
import { getAvailableIosRuntimes } from "../utilities/iosRuntimes";
import { DeviceInfo, PLATFORM } from "../utilities/device";
import { removeEmulator } from "./AndroidEmulatorDevice";

const DEVICE_MANAGER_COMMANDS = [
  "listAllAndroidImages",
  "listInstalledAndroidImages",
  "processAndroidImageChanges",
  "processIosRuntimeChanges",
  "listAllInstalledIOSRuntimes",
  "removeSimulator",
];

export class DeviceManager {
  constructor(private webview: Webview) {}

  startListening() {
    this.webview.onDidReceiveMessage((message: any) => {
      const command = message.command;

      if (!DEVICE_MANAGER_COMMANDS.includes(command)) {
        return;
      }

      Logger.log(`Device Manager received a message with command ${command}.`);

      switch (command) {
        case "listAllAndroidImages":
          this.listAllAndroidImages();
          return;
        case "listInstalledAndroidImages":
          this.listInstalledAndroidImages();
          return;
        case "processAndroidImageChanges":
          this.processAndroidImageChanges(message.toRemove, message.toInstall);
          return;
        case "processIosRuntimeChanges":
          this.processIosRuntimeChanges(message.toRemove, message.toInstall);
          return;
        case "listAllInstalledIOSRuntimes":
          this.listInstalledIosRuntimes();
          return;
        case "removeSimulator":
          this.removeSimulator(message.device);
          return;
      }
    });
  }

  private async processIosRuntimeChanges(toRemove: RuntimeInfo[], toInstall: RuntimeInfo[]) {
    if (!!toInstall.length) {
      // TODO: implement
    }

    if (!!toRemove.length) {
      await removeIosRuntimes(toRemove);
    }

    this.webview.postMessage({
      command: "iOSInstallProcessFinished",
    });
  }

  private async processAndroidImageChanges(
    toRemove: AndroidImageEntry[],
    toInstall: AndroidImageEntry[]
  ) {
    const streamInstallStdoutProgress = (line: string) => {
      this.webview.postMessage({
        command: "streamAndroidInstallationProgress",
        stream: line,
      });
    };

    if (!!toInstall.length) {
      const toInstallImagePaths = toInstall.map((imageToInstall) => imageToInstall.path);
      await installSystemImages(toInstallImagePaths, streamInstallStdoutProgress);
    }

    if (!!toRemove.length) {
      const toRemoveImagePaths = toRemove.map((imageToRemove) => imageToRemove.location!);
      await removeSystemImages(toRemoveImagePaths);
    }

    const [installedImages, availableImages] = await getAndroidSystemImages();
    this.webview.postMessage({
      command: "androidInstallProcessFinished",
      installedImages,
      availableImages,
    });
  }

  private async listInstalledAndroidImages() {
    const [installedImages] = await getAndroidSystemImages();
    this.webview.postMessage({
      command: "installedAndroidImagesListed",
      images: installedImages,
    });
  }

  private async listAllAndroidImages() {
    const [installedImages, availableImages] = await getAndroidSystemImages();
    this.webview.postMessage({
      command: "allAndroidImagesListed",
      installedImages,
      availableImages,
    });
  }

  private async listInstalledIosRuntimes() {
    const runtimes = await getAvailableIosRuntimes();
    this.webview.postMessage({
      command: "allInstalledIOSRuntimesListed",
      runtimes,
    });
  }

  private async removeSimulator(device: DeviceInfo) {
    if (device.platform === PLATFORM.IOS) {
      removeIosSimulator(device.udid);
    }
    if (device.platform === PLATFORM.ANDROID) {
      removeEmulator(device.avdName);
    }
  }
}
