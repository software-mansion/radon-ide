import { ChildProcess } from "child_process";

const path = require("path");
const fs = require("fs");
const fg = require("fast-glob");
const child_process = require("child_process");
const readline = require("readline");

function findSimulatorStreamBinary() {
  const derivedDataPath = path.join(process.env.HOME, "Library/Developer/Xcode/DerivedData");
  const entries = fg.sync("SimulatorStreamServer*/**/Build/Products/Debug/SimulatorStreamServer", {
    cwd: derivedDataPath,
  });

  let newestFile = null;
  let newestMTime = 0;

  entries.forEach((entry) => {
    const absolutePath = path.join(derivedDataPath, entry);
    const stats = fs.statSync(absolutePath);

    if (stats.mtimeMs > newestMTime) {
      newestMTime = stats.mtimeMs;
      newestFile = absolutePath;
    }
  });

  return newestFile;
}

export class Preview {
  private subprocess: ChildProcess;

  constructor(
    platform: "Android" | "iOS",
    deviceId: string,
    iosDeviceSetPath: string | undefined,
    onReadyCallback: (previewURL: string) => void
  ) {
    console.log("Launching preview server", findSimulatorStreamBinary());

    const streamArgs = platform === "Android" ? ["android"] : ["ios", deviceId, iosDeviceSetPath];

    this.subprocess = child_process.spawn(findSimulatorStreamBinary(), streamArgs);

    const rl = readline.createInterface({
      input: this.subprocess.stdout,
      output: process.stdout,
      terminal: false,
    });

    let ready = false;

    rl.on("line", (line: string) => {
      if (line.includes("http://")) {
        console.log("Preview server ready");
        ready = true;
        onReadyCallback(line);
      }
    });
  }

  public shutdown() {
    this.subprocess.kill();
  }

  public sendTouch(xRatio: number, yRatio: number, type: "Up" | "Move" | "Down") {
    this.subprocess.stdin?.write(`touch${type} ${xRatio} ${yRatio}\n`);
  }
}
