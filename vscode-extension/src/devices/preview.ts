import { Disposable } from "vscode";
import path from "path";
import readline from "readline";
import { exec, ChildProcess } from "../utilities/subprocess";
import { extensionContext } from "../utilities/extensionContext";
import { Logger } from "../Logger";

export class Preview implements Disposable {
  private subprocess?: ChildProcess;
  public streamURL?: string;

  constructor(private args: string[]) {}

  dispose() {
    this.subprocess?.kill();
  }

  async start() {
    const simControllerBinary = path.join(extensionContext.extensionPath, "dist", "sim-controller");

    Logger.debug(`Launch preview ${simControllerBinary} ${this.args}`);
    const subprocess = exec(simControllerBinary, this.args, {});
    this.subprocess = subprocess;

    const rl = readline.createInterface({
      input: subprocess.stdout!,
      output: process.stdout,
      terminal: false,
    });

    return new Promise<string>((resolve, reject) => {
      subprocess.catch((reason) => {
        Logger.error("Preview server exited unexpectedly", reason);
        reject(new Error(`Preview server exited with code ${reason.exitCode}`));
      });
      subprocess.then(() => {
        // we expect the preview server to produce a line with the URL
        // if it doesn't do that and exists w/o error, we still want to reject
        // the promise to prevent the caller from waiting indefinitely
        reject(new Error("Preview server exited without URL"));
      });

      rl.on("line", (line: string) => {
        if (line.includes("http://")) {
          Logger.debug(`Preview server ready ${line}`);
          this.streamURL = line;
          resolve(this.streamURL);
        }
        Logger.debug("Preview server:", line);
      });
    });
  }

  public sendTouch(xRatio: number, yRatio: number, type: "Up" | "Move" | "Down") {
    this.subprocess?.stdin?.write(`touch${type} ${xRatio} ${yRatio}\n`);
  }

  public sendKey(keyCode: number, direction: "Up" | "Down") {
    this.subprocess?.stdin?.write(`key${direction} ${keyCode}\n`);
  }
}
