import path from "path";
import { Disposable, workspace } from "vscode";
import { exec, ChildProcess, lineReader } from "../utilities/subprocess";
import { Logger } from "../Logger";
import { simulatorServerBinary } from "../utilities/simulatorServerBinary";
import { watchLicenseTokenChange } from "../utilities/license";
import { DeviceButtonType, MultimediaData, TouchPoint } from "../common/DeviceSessionsManager";

interface MultimediaPromiseHandlers {
  resolve: (value: MultimediaData) => void;
  reject: (reason?: any) => void;
}

enum MultimediaType {
  Video = "video",
  Screenshot = "screenshot",
}

export class Preview implements Disposable {
  private multimediaPromises = new Map<string, MultimediaPromiseHandlers>();
  private subprocess?: ChildProcess;
  private tokenChangeListener?: Disposable;
  public streamURL?: string;

  constructor(private args: string[]) {}

  dispose() {
    this.subprocess?.kill();
    this.tokenChangeListener?.dispose();
  }

  private sendCommandOrThrow(command: string) {
    const stdin = this.subprocess?.stdin;
    if (!stdin) {
      throw new Error("sim-server process not available");
    }
    stdin.write(command);
  }

  private saveMultimediaWithID(type: MultimediaType, id: string): Promise<MultimediaData> {
    const stdin = this.subprocess?.stdin;
    if (!stdin) {
      throw new Error("sim-server process not available");
    }

    let resolvePromise: (value: MultimediaData) => void;
    let rejectPromise: (reason?: any) => void;
    const promise = new Promise<MultimediaData>((resolve, reject) => {
      resolvePromise = resolve;
      rejectPromise = reject;
    });

    const lastPromise = this.multimediaPromises.get(id);
    if (lastPromise) {
      promise.then(lastPromise.resolve, lastPromise.reject);
    }

    const newPromiseHandler = { resolve: resolvePromise!, reject: rejectPromise! };
    this.multimediaPromises.set(id, newPromiseHandler);
    stdin.write(`${type} ${id} ${type === "video" ? "save" : ""}\n`);
    return promise;
  }

  async start() {
    const simControllerBinary = simulatorServerBinary();

    Logger.debug(`Launch preview ${simControllerBinary} ${this.args}`);

    const subprocess = exec(simControllerBinary, this.args, {
      buffer: false,
    });
    this.subprocess = subprocess;

    this.tokenChangeListener = watchLicenseTokenChange((token) => {
      if (token) {
        this.sendCommandOrThrow(`token ${token}\n`);
      }
    });

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
        } else if (
          line.includes("video_ready") ||
          line.includes("video_error") ||
          line.includes("screenshot_ready") ||
          line.includes("screenshot_error")
        ) {
          // multimedia response format for recordings and screenshots looks as follows:
          // video_ready <VIDEO_ID> <HTTP_URL> <FILE_URL>
          // video_error <VIDEO_ID> <Error message>
          // screenshot_ready <id> <url> <local-path>
          // screenshot_error <id> <reason>
          const multimediaReadyMatch = line.match(
            /(video_ready|screenshot_ready) (\S+) (\S+) (\S+)/
          );
          const multimediaErrorMatch = line.match(/(video_error|screenshot_error) (\S+) (.*)/);

          const id = multimediaReadyMatch
            ? multimediaReadyMatch[2]
            : multimediaErrorMatch
              ? multimediaErrorMatch[2]
              : "";

          const handlers = this.multimediaPromises.get(id);
          this.multimediaPromises.delete(id);
          if (handlers && multimediaReadyMatch) {
            // match array looks as follows:
            // [0] - full match
            // [1] - ID of the multimedia
            // [2] - URL or error message
            // [3] - File URL
            const tempFileLocation = multimediaReadyMatch[4];
            const ext = path.extname(tempFileLocation);
            const fileName = workspace.name ? `${workspace.name} ${id}${ext}` : `${id}${ext}`;
            handlers.resolve({
              url: multimediaReadyMatch[3],
              tempFileLocation,
              fileName,
            });
          } else if (handlers && multimediaErrorMatch) {
            handlers.reject(new Error(multimediaErrorMatch[3]));
          }
        }
        Logger.info("sim-server:", line);
      });
    });
  }

  public showTouches() {
    this.subprocess?.stdin?.write("pointer show true\n");
  }

  public hideTouches() {
    this.subprocess?.stdin?.write("pointer show false\n");
  }

  public startRecording() {
    this.sendCommandOrThrow(`video recording start -b 2000\n`); // 2000MB buffer for on-disk video
  }

  public captureAndStopRecording() {
    const recordingDataPromise = this.saveMultimediaWithID(MultimediaType.Video, "recording");
    this.sendCommandOrThrow(`video recording stop\n`);
    return recordingDataPromise;
  }

  public startReplays() {
    this.sendCommandOrThrow(`video replay start -m -b 50\n`); // 50MB buffer for in-memory video
  }

  public stopReplays() {
    this.sendCommandOrThrow(`video replay stop\n`);
  }

  public captureReplay() {
    return this.saveMultimediaWithID(MultimediaType.Video, "replay");
  }

  public captureScreenShot() {
    return this.saveMultimediaWithID(MultimediaType.Screenshot, "screenshot");
  }

  public sendTouches(touches: Array<TouchPoint>, type: "Up" | "Move" | "Down") {
    const touchesCoords = touches.map((pt) => `${pt.xRatio},${pt.yRatio}`).join(" ");
    this.subprocess?.stdin?.write(`touch ${type} ${touchesCoords}\n`);
  }

  public sendKey(keyCode: number, direction: "Up" | "Down") {
    this.subprocess?.stdin?.write(`key ${direction} ${keyCode}\n`);
  }

  public sendButton(button: DeviceButtonType, direction: "Up" | "Down") {
    this.subprocess?.stdin?.write(`button ${direction} ${button}\n`);
  }

  public sendClipboard(text: string) {
    // We use markers for start and end of the paste to handle multi-line pastes
    this.subprocess?.stdin?.write(`paste START-SIMSERVER-PASTE>>>${text}<<<END-SIMSERVER-PASTE\n`);
  }

  public sendWheel(point: TouchPoint, deltaX: number, deltaY: number) {
    this.subprocess?.stdin?.write(
      `wheel ${point.xRatio},${point.yRatio} --dx ${this.normalizeWheel(
        deltaX
      )} --dy ${this.normalizeWheel(deltaY)}\n`
    );
  }

  /*
  Positive delta values mean scrolling down/right, negative values mean scrolling up/left.
  We normalize deltas to 3-7 range (depending on the magnitude) for a better scrolling experience,
  as the incoming values can vary from 4 to 400 and more.
  */
  normalizeWheel(delta: number) {
    const longWheelThreshold = 150;
    const mediumWheelThreshold = 50;
    const absoluteDelta = Math.abs(delta);

    const multiplier =
      absoluteDelta > longWheelThreshold ? 7 : absoluteDelta > mediumWheelThreshold ? 5 : 3;

    // We're negating the return value for the scroll to reflect the wheel direction
    return -Math.sign(delta) * multiplier;
  }
}
