import fs from "fs";
import { Disposable } from "vscode";
import { EMULATOR_BINARY } from "../devices/AndroidEmulatorDevice";
import { Platform } from "../utilities/platform";
import { StateManager } from "../project/StateManager";
import { EnvironmentDependencyStatuses } from "../common/State";
import { testCommand } from "../utilities/testCommand";
import { disposeAll } from "../utilities/disposables";

export class EnvironmentDependencyManager implements Disposable {
  private disposables: Disposable[] = [];

  constructor(private stateManager: StateManager<EnvironmentDependencyStatuses>) {
    this.runAllDependencyChecks();
    this.disposables.push(this.stateManager);
  }

  public async runAllDependencyChecks() {
    this.checkAndroidEmulatorBinaryStatus();

    if (Platform.OS === "macos") {
      this.checkXcodebuildCommandStatus();
    }

    this.checkNodeCommandStatus();
  }

  private async checkAndroidEmulatorBinaryStatus() {
    try {
      await fs.promises.access(EMULATOR_BINARY, fs.constants.X_OK);
      this.stateManager.updateState({
        androidEmulator: { status: "installed", isOptional: false },
      });
    } catch (e) {
      this.stateManager.updateState({
        androidEmulator: { status: "notInstalled", isOptional: false },
      });
    }
  }

  private async checkXcodebuildCommandStatus() {
    const isXcodebuildInstalled = await testCommand("xcodebuild -version");
    const isXcrunInstalled = await testCommand("xcrun --version");
    const isSimctlInstalled = await testCommand("xcrun simctl help");

    const isInstalled = isXcodebuildInstalled && isXcrunInstalled && isSimctlInstalled;
    this.stateManager.updateState({
      xcode: { status: isInstalled ? "installed" : "notInstalled", isOptional: false },
    });
  }

  private async checkNodeCommandStatus() {
    const installed = await testCommand("node -v");
    this.stateManager.updateState({
      nodejs: { status: installed ? "installed" : "notInstalled", isOptional: false },
    });
  }

  dispose() {
    disposeAll(this.disposables);
  }
}
