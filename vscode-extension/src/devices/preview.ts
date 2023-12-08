import { ChildProcess } from "child_process";
import { Disposable } from "vscode";
import path from "path";
import fs from "fs";
import fg from "fast-glob";
import readline from "readline";
import { spawnWithLog } from "../utilities/subprocess";
import { Logger } from "../Logger";

function findSimulatorStreamBinary() {
  const derivedDataPath = path.join(process.env.HOME!, "Library/Developer/Xcode/DerivedData");
  const entries = fg.sync("SimulatorStreamServer*/**/Build/Products/Debug/SimulatorStreamServer", {
    cwd: derivedDataPath,
  });

  let newestFile: string | undefined;
  let newestMTime = 0;

  entries.forEach((entry) => {
    const absolutePath = path.join(derivedDataPath, entry);
    const stats = fs.statSync(absolutePath);

    if (stats.mtimeMs > newestMTime) {
      newestMTime = stats.mtimeMs;
      newestFile = absolutePath;
    }
  });

  if (!newestFile) {
    throw new Error("Couldn't locate simulator streamer binary");
  }

  return newestFile;
}

export class Preview implements Disposable {
  private subprocess: ChildProcess | undefined;
  private args: string[];
  public streamURL: string | undefined;

  constructor(args: string[]) {
    this.args = args;
  }

  dispose() {
    this.subprocess?.kill();
  }

  async start() {
    Logger.log(`Launching preview server ${findSimulatorStreamBinary()}`);

    const streamServerBinary = findSimulatorStreamBinary();
    Logger.log(`Launch preview ${streamServerBinary} ${this.args}`);
    const subprocess = spawnWithLog(streamServerBinary, this.args, {});
    this.subprocess = subprocess;

    const rl = readline.createInterface({
      input: subprocess.stdout!,
      output: process.stdout,
      terminal: false,
    });

    let resolve: (previewURL: string) => void = () => {};
    const result = new Promise<string>((res) => {
      resolve = res;
    });

    rl.on("line", (line: string) => {
      if (line.includes("http://")) {
        Logger.log(`Preview server ready ${line}`);
        this.streamURL = line;
        resolve(this.streamURL);
      }
    });
    return result;
  }

  public sendTouch(xRatio: number, yRatio: number, type: "Up" | "Move" | "Down") {
    this.subprocess?.stdin?.write(`touch${type} ${xRatio} ${yRatio}\n`);
  }

  public sendKey(keyCode: number, direction: "Up" | "Down") {
    this.subprocess?.stdin?.write(`key${direction} ${keyCode}\n`);
  }
}
