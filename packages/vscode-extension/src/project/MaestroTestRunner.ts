import { promises } from "fs";
import { homedir } from "os";
import path from "path";
import * as vscode from "vscode";
import { Disposable } from "vscode";
import { ExecaError } from "execa";
import { Output } from "../common/OutputChannel";
import { DevicePlatform } from "../common/State";
import { OutputChannelRegistry } from "./OutputChannelRegistry";
import { DeviceBase } from "../devices/DeviceBase";
import { ChildProcess, exec, lineReader } from "../utilities/subprocess";
import { getOrCreateDeviceSet, IosSimulatorDevice } from "../devices/IosSimulatorDevice";

export class MaestroTestRunner implements Disposable {
  private readonly device: DeviceBase;
  private readonly useExpoGo: boolean = false;
  private maestroProcess: ChildProcess | undefined;

  constructor(
    device: DeviceBase,
    protected readonly outputChannelRegistry: OutputChannelRegistry,
    useExpoGo: boolean = false
  ) {
    this.device = device;
    this.useExpoGo = useExpoGo;
  }

  private get outputChannel() {
    return this.outputChannelRegistry.getOrCreateOutputChannel(
      this.device.platform === DevicePlatform.Android ? Output.MaestroAndroid : Output.MaestroIos
    );
  }

  public async startMaestroTest(fileNames: string[]): Promise<void> {
    this.outputChannel.show(true);
    this.outputChannel.appendLine("");

    const deviceName = this.device.deviceInfo.displayName;
    if (fileNames.length === 1) {
      const fileName = fileNames[0];
      const isFile = (await promises.lstat(fileName)).isFile();
      if (isFile) {
        const document = await vscode.workspace.openTextDocument(fileName);
        if (document.isDirty) {
          await document.save();
        }
      }
      this.outputChannel.appendLine(
        `Starting ${isFile ? "a Maestro flow" : "all Maestro flows"} from ${fileName} on ${deviceName}`
      );
    } else {
      this.outputChannel.appendLine(
        `Starting ${fileNames.length} Maestro flows: ${fileNames.join(", ")} on ${deviceName}`
      );
    }

    // Right now, for running iOS tests, Maestro uses xcodebuild test-without-building,
    // which does not support simulators located outside the default device set.
    // The creators provide a prebuilt XCTest runner that can be ran through simctl,
    // and even have have written working code that uses it, but as for now
    // there's no built-in way to call these methods with Maestro CLI.
    // As a workaround, we replace the xcodebuild command with instructions
    // similar to what Maestro would do in prebuilt mode, and wrap the xcrun
    // command to provide our own device set with the --set flag.
    const shimPath = path.resolve(__dirname, "..", "scripts", "shims");
    const maestroProcess = exec("maestro", ["--device", this.device.id, "test", ...fileNames], {
      buffer: false,
      stdin: "ignore",
      reject: true,
      cwd: homedir(),
      env: {
        PATH: `${shimPath}:${process.env.PATH}`,
        CUSTOM_DEVICE_SET: getOrCreateDeviceSet(
          this.device instanceof IosSimulatorDevice ? this.device.deviceInfo.id : undefined
        ),
      },
    });
    this.maestroProcess = maestroProcess;
    lineReader(maestroProcess).onLineRead(this.outputChannel.appendLine);

    await maestroProcess.then(
      (resolved) => {
        this.outputChannel.appendLine("Maestro test completed successfully!");
      },
      (error: ExecaError) => {
        this.outputChannel.appendLine(`Maestro test failed with exit code ${error.exitCode}`);
      }
    );
    this.maestroProcess = undefined;
  }

  public async stopMaestroTest(): Promise<void> {
    if (!this.maestroProcess) {
      return;
    }
    this.outputChannel.appendLine("Aborting Maestro test...");
    const proc = this.maestroProcess;
    try {
      proc.kill();
    } catch (e) {}

    const killer = setTimeout(() => {
      try {
        proc.kill(9);
      } catch (e) {}
    }, 3000);

    try {
      await proc;
    } catch (e) {}
    clearTimeout(killer);
    this.maestroProcess = undefined;
    this.outputChannel.appendLine("Maestro test aborted");
  }

  public dispose() {
    return this.stopMaestroTest();
  }
}
