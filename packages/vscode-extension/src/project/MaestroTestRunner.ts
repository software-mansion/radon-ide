import { promises } from "fs";
import { homedir } from "os";
import path from "path";
import * as vscode from "vscode";
import { Disposable } from "vscode";
import { DeviceInfo, DevicePlatform, DeviceType } from "../common/State";
import { DeviceBase } from "../devices/DeviceBase";
import { ChildProcess, exec, lineReader } from "../utilities/subprocess";
import { getOrCreateDeviceSet, IosSimulatorDevice } from "../devices/IosSimulatorDevice";
import { extensionContext } from "../utilities/extensionContext";
import { Logger } from "../Logger";
import { getTelemetryReporter } from "../utilities/telemetry";

class MaestroPseudoTerminal implements vscode.Pseudoterminal {
  private writeEmitter = new vscode.EventEmitter<string>();
  private closeEmitter = new vscode.EventEmitter<number | void>();
  private prefix: string | undefined;

  onDidWrite: vscode.Event<string> = this.writeEmitter.event;
  onDidClose?: vscode.Event<number | void> = this.closeEmitter.event;

  constructor(prefix?: string) {
    this.prefix = prefix;
  }

  open(_initialDimensions: vscode.TerminalDimensions | undefined): void {}

  close(): void {
    this.writeEmitter.dispose();
    this.closeEmitter.dispose();
  }

  write(data: string): void {
    this.writeEmitter.fire(`${this.prefix && data.trim() !== "" ? this.prefix + " " : ""}${data}`);
  }

  writeLine(line: string): void {
    this.write(line + "\r\n");
  }

  clear(): void {
    this.writeEmitter.fire("\x1b[2J\x1b[1;1H");
  }

  exit(code?: number): void {
    this.closeEmitter.fire(code);
  }
}

enum DeviceFamily {
  IPHONE_SIMULATOR = "iphone_simulator",
  IPAD_SIMULATOR = "ipad_simulator",
  ANDROID_EMULATOR = "android_emulator",
  ANDROID_PHYSICAL = "android_physical",
}

function getDeviceFamily(deviceInfo: DeviceInfo) {
  if (deviceInfo.platform === DevicePlatform.IOS) {
    if (deviceInfo.deviceType === DeviceType.Tablet) {
      return DeviceFamily.IPAD_SIMULATOR;
    }
    return DeviceFamily.IPHONE_SIMULATOR;
  }

  if (deviceInfo.emulator) {
    return DeviceFamily.ANDROID_EMULATOR;
  }
  return DeviceFamily.ANDROID_PHYSICAL;
}

export class MaestroTestRunner implements Disposable {
  private readonly device: DeviceBase;
  private terminal: vscode.Terminal | undefined;
  private pty: MaestroPseudoTerminal | undefined;
  private maestroProcess: ChildProcess | undefined;
  private onCloseTerminal: vscode.Disposable | undefined;

  constructor(device: DeviceBase) {
    this.device = device;
  }

  private getOrCreateTerminal(): { terminal: vscode.Terminal; pty: MaestroPseudoTerminal } {
    if (this.terminal && this.pty) {
      return { terminal: this.terminal, pty: this.pty };
    }
    const devicePlatformColor = this.device.platform === DevicePlatform.Android ? "32" : "36";
    const devicePrefix = `\x1b[${devicePlatformColor}m[${this.device.deviceInfo.displayName}]\x1b[0m`;
    const pty = new MaestroPseudoTerminal(devicePrefix);
    const terminalName = `${this.device.platform === DevicePlatform.Android ? "Android" : "iOS"} Maestro test (${this.device.deviceInfo.displayName})`;

    const terminal = vscode.window.createTerminal({
      name: terminalName,
      pty,
      iconPath: new vscode.ThemeIcon("beaker"),
    });

    this.onCloseTerminal = vscode.window.onDidCloseTerminal((closedTerminal) => {
      if (closedTerminal === terminal) {
        this.terminal = undefined;
        this.pty = undefined;
        this.onCloseTerminal?.dispose();
        this.onCloseTerminal = undefined;
        this.stopMaestroTest();
      }
    });

    this.terminal = terminal;
    this.pty = pty;
    return { terminal, pty };
  }

  public async startMaestroTest(fileNames: string[]): Promise<void> {
    const deviceFamily = getDeviceFamily(this.device.deviceInfo);
    getTelemetryReporter().sendTelemetryEvent(`maestro:test_started:${deviceFamily}`);

    const { terminal, pty } = this.getOrCreateTerminal();
    terminal.show(true);
    // For some reason the terminal isn't ready immediately and loses initial output
    await new Promise((resolve) => setTimeout(resolve, 100));
    pty.clear();

    if (fileNames.length === 1) {
      const fileName = fileNames[0];
      const isFile = (await promises.lstat(fileName)).isFile();
      if (isFile) {
        const document = await vscode.workspace.openTextDocument(fileName);
        if (document.isDirty) {
          await document.save();
        }
      }
      pty.writeLine(`Starting ${isFile ? "a Maestro flow" : "all Maestro flows"} from ${fileName}`);
    } else {
      pty.writeLine(`Starting ${fileNames.length} Maestro flows: ${fileNames.join(", ")}`);
    }

    // NOTE: maestro sets application permissions using the `applesimutils` utility,
    // which does not support custom device sets.
    // To work around this, we create a symlink to the target Radon device
    // in the default simulator location for the duration of the test, and remove it afterwards.
    const cleanupSymlink = await this.setupSimulatorSymlink();
    try {
      await this.runMaestro(fileNames, pty);
      pty.writeLine(`\x1b[32mMaestro test completed successfully!\x1b[0m`);
      getTelemetryReporter().sendTelemetryEvent(`maestro:test_completed:${deviceFamily}`);
    } catch (error) {
      const exitCode =
        error && typeof error === "object" && "exitCode" in error ? error.exitCode : null;
      // SIGTERM exit code
      if (exitCode !== null && exitCode !== 143) {
        pty.writeLine(`\x1b[31mMaestro test failed with exit code ${exitCode}\x1b[0m`);
        getTelemetryReporter().sendTelemetryEvent(`maestro:test_failed:${deviceFamily}`);
      }
    } finally {
      await cleanupSymlink();
    }
    this.maestroProcess = undefined;
  }

  public async stopMaestroTest(): Promise<void> {
    if (!this.maestroProcess) {
      return;
    }
    const deviceFamily = getDeviceFamily(this.device.deviceInfo);

    this.pty?.writeLine("");
    this.pty?.writeLine(`\x1b[33mAborting Maestro test...\x1b[0m`);

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

    this.pty?.writeLine(`\x1b[33mMaestro test aborted\x1b[0m`);
    getTelemetryReporter().sendTelemetryEvent(`maestro:test_aborted:${deviceFamily}`);
  }

  public async dispose() {
    await this.stopMaestroTest();
    this.pty?.exit();
    this.terminal?.dispose();
    this.onCloseTerminal?.dispose();
    this.pty = undefined;
    this.terminal = undefined;
    this.onCloseTerminal = undefined;
  }

  private async runMaestro(fileNames: string[], pty: MaestroPseudoTerminal) {
    // Right now, for running iOS tests, Maestro uses xcodebuild test-without-building,
    // which does not support simulators located outside the default device set.
    // The creators provide a prebuilt XCTest runner that can be ran through simctl,
    // and even have have written working code that uses it, but as for now
    // there's no built-in way to call these methods with Maestro CLI.
    // As a workaround, we replace the xcodebuild command with instructions
    // similar to what Maestro would do in prebuilt mode, and wrap the xcrun
    // command to provide our own device set with the --set flag.
    const shimPath = path.resolve(extensionContext.extensionPath, "shims", "maestro");

    const maestroProcess = exec("maestro", ["--device", this.device.id, "test", ...fileNames], {
      buffer: false,
      reject: true,
      stdin: "ignore",
      cwd: homedir(),
      env: {
        PATH: `${shimPath}:${process.env.PATH}`,
        CUSTOM_DEVICE_SET: getOrCreateDeviceSet(
          this.device instanceof IosSimulatorDevice ? this.device.deviceInfo.id : undefined
        ),
      },
    });
    this.maestroProcess = maestroProcess;

    lineReader(maestroProcess).onLineRead((line) => {
      const colorize = (text: string, colorCode: string) => `\x1b[${colorCode}m${text}\x1b[0m`;
      const replacements: Array<[RegExp, (match: string) => string]> = [
        [/COMPLETED/g, (m) => colorize(m, "32")],
        [/FAILED/g, (m) => colorize(m, "31")],
        [/\[Passed\]/g, () => colorize("[Passed]", "32")],
        [/\[Failed\]/g, () => colorize("[Failed]", "31")],
      ];
      for (const [re, fn] of replacements) {
        line = line.replace(re, fn);
      }
      pty.writeLine(line);
    });

    await maestroProcess;
  }

  private async setupSimulatorSymlink() {
    if (this.device.platform !== DevicePlatform.IOS) {
      return async () => {
        // NOOP
      };
    }
    const id = this.device.id;
    const devicePath = path.join(getOrCreateDeviceSet(id), id);
    const coreSimulatorPath = path.join(
      homedir(),
      "Library",
      "Developer",
      "CoreSimulator",
      "Devices",
      id
    );

    async function cleanupSymlink() {
      try {
        return await promises.unlink(coreSimulatorPath);
      } catch {
        // NOTE: not much we can do here.
        // The symlink will remain, but it should not impact the user.
        Logger.error("Failed to remove simulator symlink: ", coreSimulatorPath);
      }
    }

    try {
      await promises.symlink(devicePath, coreSimulatorPath);
      return cleanupSymlink;
    } catch (e) {
      // NOTE: check if symlink already exists and points to the correct location
      const existingLink = await promises.readlink(coreSimulatorPath).catch(() => null);
      if (existingLink === devicePath) {
        // NOTE: the symlink might be left here from a previous run,
        // for example if the extension or VSCode was closed while the test was running,
        // and cleanup didn't get to run to completion.
        // We clean up the symlink in that case here.
        // Let's hope the user did not create the symlink themselves for whatever reason...
        return cleanupSymlink;
      }
    }
    return async () => {
      // NOOP
    };
  }
}
