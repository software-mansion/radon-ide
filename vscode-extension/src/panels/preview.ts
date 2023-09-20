import { ChildProcess } from "child_process";

const child_process = require("child_process");
const readline = require("readline");

export class Preview {
  private subprocess: ChildProcess;

  constructor(onReadyCallback: (previewURL: string) => void) {
    console.log("Launching preview server");
    this.subprocess = child_process.spawn(
      "/Users/mdk/Library/Developer/Xcode/DerivedData/SimulatorStreamServer-fiwagsjzioxfbhfzhgdrjjsfsavj/Build/Products/Debug/SimulatorStreamServer",
      ["android", "RNPreviews"]
    );

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
