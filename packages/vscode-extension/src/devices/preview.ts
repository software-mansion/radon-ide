import { Disposable } from "vscode";
import path from "path";
import { exec, ChildProcess, lineReader } from "../utilities/subprocess";
import { extensionContext } from "../utilities/extensionContext";
import { Logger } from "../Logger";
import { Platform } from "../utilities/platform";
import { TouchPoint } from "../common/Project";

export class Preview implements Disposable {
  private subprocess?: ChildProcess;
  public streamURL?: string;

  constructor(private args: string[]) {}

  dispose() {
    this.subprocess?.kill();
  }

  async start() {
    const simControllerBinary = path.join(
      extensionContext.extensionPath,
      "dist",
      Platform.select({ macos: "sim-server-executable", windows: "sim-server-executable.exe" })
    );

    Logger.debug(`Launch preview ${simControllerBinary} ${this.args}`);
    const subprocess = exec(simControllerBinary, this.args, { buffer: false });
    this.subprocess = subprocess;

    return new Promise<string>((resolve, reject) => {
      subprocess.catch(reject).then(() => {
        // we expect the preview server to produce a line with the URL
        // if it doesn't do that and exists w/o error, we still want to reject
        // the promise to prevent the caller from waiting indefinitely
        reject(new Error("Preview server exited without URL"));
      });

      const streamURLRegex = /(http:\/\/[^ ]*stream\.mjpeg)/;

      lineReader(subprocess).onLineRead((line) => {
        const match = line.match(streamURLRegex);

        if (match) {
          Logger.debug(`Preview server ready ${match[1]}`);

          this.streamURL = match[1];
          resolve(this.streamURL);
        }
        Logger.debug("Preview server:", line);
      });
    });
  }

  public sendTouches(touches: Array<TouchPoint>, type: "Up" | "Move" | "Down") {
    const fff = `touch${type} ` + touches.map((pt) => `${pt.xRatio} ${pt.yRatio}`).join(" ") + "\n";
    this.subprocess?.stdin?.write(fff);
  }

  public sendKey(keyCode: number, direction: "Up" | "Down") {
    this.subprocess?.stdin?.write(`key${direction} ${keyCode}\n`);
  }

  public sendPaste(text: string) {
    this.subprocess?.stdin?.write(`paste ${text}\n`);
  }
}
