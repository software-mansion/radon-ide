import { Disposable, Uri } from "vscode";
import path from "path";
import { exec, ChildProcess, lineReader } from "../utilities/subprocess";
import { extensionContext } from "../utilities/extensionContext";
import { Logger } from "../Logger";
import { Platform } from "../utilities/platform";
import { TouchPoint } from "../common/Project";
import { TabPanel } from "../panels/Tabpanel";
import { WebviewController } from "../panels/WebviewController";

interface ReplayPromiseHandlers {
  resolve: (value: string) => void;
  reject: (reason?: any) => void;
}

export class Preview implements Disposable {
  private subprocess?: ChildProcess;
  public streamURL?: string;
  private lastReplayPromise?: ReplayPromiseHandlers;

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

    const subprocess = exec(simControllerBinary, this.args, {
      buffer: false,
    });
    this.subprocess = subprocess;

    return new Promise<string>((resolve, reject) => {
      subprocess.catch(reject).then(() => {
        // we expect the preview server to produce a line with the URL
        // if it doesn't do that and exists w/o error, we still want to reject
        // the promise to prevent the caller from waiting indefinitely
        reject(new Error("Preview server exited without URL"));
      });

      lineReader(subprocess).onLineRead((line, stderr) => {
        if (stderr) {
          Logger.info("sim-server:", line);
          return;
        }

        if (line.includes("stream_ready")) {
          const streamURLRegex = /(http:\/\/[^ ]*stream\.mjpeg)/;
          const match = line.match(streamURLRegex);

          if (match) {
            Logger.info(`Stream ready ${match[1]}`);

            this.streamURL = match[1];
            resolve(this.streamURL);
          }
        } else if (line.includes("video_ready replay") || line.includes("video_error replay")) {
          // video response format for replays looks as follows:
          // video_ready replay <URL>
          // video_error replay <Error message>
          const replayResponseRegex = /video_(ready|error) replay (.*)/;
          const match = line.match(replayResponseRegex);
          if (match) {
            // match array looks as follows:
            // [0] - full match
            // [1] - "ready" or "error"
            // [2] - URL or error message
            const handlers = this.lastReplayPromise;
            this.lastReplayPromise = undefined;
            if (handlers) {
              if (match[1] === "video_error") {
                handlers.reject(new Error(match[2]));
              } else {
                handlers.resolve(match[2]);
              }
            }
          }
        }
        Logger.info("sim-server:", line);
      });
    });
  }

  public async startReplays() {
    const stdin = this.subprocess?.stdin;
    if (!stdin) {
      throw new Error("sim-server process not available");
    }
    stdin.write("video replay start -m -b 50\n"); // 50MB buffer for in-memory video
  }

  public captureReplay() {
    const stdin = this.subprocess?.stdin;
    if (!stdin) {
      throw new Error("sim-server process not available");
    }
    let resolvePromise: (value: string) => void;
    let rejectPromise: (reason?: any) => void;
    const promise = new Promise<string>((resolve, reject) => {
      resolvePromise = resolve;
      rejectPromise = reject;
    });
    if (this.lastReplayPromise) {
      promise.then(this.lastReplayPromise.resolve, this.lastReplayPromise.reject);
    }
    this.lastReplayPromise = { resolve: resolvePromise!, reject: rejectPromise! };
    stdin.write(`video replay stop\n`);
    // immediately restart replays
    this.startReplays();
    return promise;
  }

  public sendTouches(touches: Array<TouchPoint>, type: "Up" | "Move" | "Down") {
    const touchesCoords = touches.map((pt) => `${pt.xRatio},${pt.yRatio}`).join(" ");
    this.subprocess?.stdin?.write(`touch ${type} ${touchesCoords}\n`);
  }

  public sendKey(keyCode: number, direction: "Up" | "Down") {
    this.subprocess?.stdin?.write(`key ${direction} ${keyCode}\n`);
  }

  public sendPaste(text: string) {
    this.subprocess?.stdin?.write(`paste ${text}\n`);
  }
}
