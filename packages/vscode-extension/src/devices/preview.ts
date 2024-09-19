import { Disposable } from "vscode";
import path from "path";
import { exec, ChildProcess, lineReader } from "../utilities/subprocess";
import { extensionContext } from "../utilities/extensionContext";
import { Logger } from "../Logger";
import { Platform } from "../utilities/platform";
import { TouchPoint } from "../common/Project";

interface ReplayPromiseHandlers {
  resolve: (value: string) => void;
  reject: (reason?: any) => void;
}

export class Preview implements Disposable {
  private subprocess?: ChildProcess;
  public streamURL?: string;
  private replayPromises: Map<number, ReplayPromiseHandlers> = new Map();
  private replayCounter = 0;

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

    let simControllerBinaryEnv: { DYLD_FRAMEWORK_PATH: string } | undefined;

    if (Platform.OS === "macos") {
      const { stdout } = await exec("xcode-select", ["-p"]);
      const DYLD_FRAMEWORK_PATH = path.join(stdout, "Library", "PrivateFrameworks");
      Logger.debug(`Setting DYLD_FRAMEWORK_PATH to ${DYLD_FRAMEWORK_PATH}`);
      simControllerBinaryEnv = { DYLD_FRAMEWORK_PATH };
    }

    const subprocess = exec(simControllerBinary, this.args, {
      buffer: false,
      env: simControllerBinaryEnv,
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

        if (line.includes("Serving MJPEG")) {
          const streamURLRegex = /(http:\/\/[^ ]*stream\.mjpeg)/;
          const match = line.match(streamURLRegex);

          if (match) {
            Logger.info(`Stream ready ${match[1]}`);

            this.streamURL = match[1];
            resolve(this.streamURL);
          }
        } else if (line.includes("replay_ready") || line.includes("replay_error")) {
          // replay response format message format looks as follows:
          // replay_ready <ID> <URL>
          // replay_error <ID> <Error message>
          const replayResponseRegex = /(replay_(ready|error)) (\d+) (.*)/;
          const match = line.match(replayResponseRegex);
          if (match) {
            const id = parseInt(match[1], 10);
            const handlers = this.replayPromises.get(id);
            if (handlers) {
              if (match[0] === "replay_error") {
                handlers.reject(new Error(match[2]));
              } else {
                handlers.resolve(match[2]);
              }
              this.replayPromises.delete(id);
            }
          }
        }
        Logger.info("sim-server:", line);
      });
    });
  }

  public createVideoSnapshot() {
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
    this.replayCounter += 1;
    this.replayPromises.set(this.replayCounter, {
      resolve: resolvePromise!,
      reject: rejectPromise!,
    });
    stdin.write("replay 10\n");
    return promise;
  }

  public sendTouches(touches: Array<TouchPoint>, type: "Up" | "Move" | "Down") {
    const touchesCoords = touches.map((pt) => `${pt.xRatio} ${pt.yRatio}`).join(" ");
    this.subprocess?.stdin?.write(`touch${type} ${touchesCoords}\n`);
  }

  public sendKey(keyCode: number, direction: "Up" | "Down") {
    this.subprocess?.stdin?.write(`key${direction} ${keyCode}\n`);
  }

  public sendPaste(text: string) {
    this.subprocess?.stdin?.write(`paste ${text}\n`);
  }
}
