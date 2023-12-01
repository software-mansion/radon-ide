import { ChildProcess } from "child_process";
import { Disposable, ExtensionContext } from "vscode";
import path from "path";
import child_process from "child_process";
import readline from "readline";

export class Preview implements Disposable {
  private subprocess: ChildProcess | undefined;
  public streamURL: string | undefined;

  constructor(private context: ExtensionContext, private args: string[]) {}

  dispose() {
    this.subprocess?.kill();
  }

  async start() {
    const simControllerBinary = path.join(
      this.context.extensionPath,
      "out",
      "bin",
      "sim-controller"
    );

    console.log("Launch preview", simControllerBinary, this.args);
    const subprocess = child_process.spawn(simControllerBinary, this.args);
    this.subprocess = subprocess;

    const rl = readline.createInterface({
      input: subprocess.stdout,
      output: process.stdout,
      terminal: false,
    });

    let resolve: (previewURL: string) => void = () => {};
    const result = new Promise<string>((res) => {
      resolve = res;
    });

    rl.on("line", (line: string) => {
      if (line.includes("http://")) {
        console.log("Preview server ready", line);
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
