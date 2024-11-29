import path from "path";
import { Disposable, workspace } from "vscode";
import { exec, ChildProcess, lineReader } from "../utilities/subprocess";
import { extensionContext } from "../utilities/extensionContext";
import { Logger } from "../Logger";
import { Platform } from "../utilities/platform";
import { RecordingData, TouchPoint } from "../common/Project";

interface VideoRecordingPromiseHandlers {
  resolve: (value: RecordingData) => void;
  reject: (reason?: any) => void;
}

export class Preview implements Disposable {
  private videoRecordingPromises = new Map<string, VideoRecordingPromiseHandlers>();
  private subprocess?: ChildProcess;
  public streamURL?: string;

  constructor(private args: string[]) {}

  dispose() {
    this.subprocess?.kill();
  }

  private sendCommandOrThrow(command: string) {
    const stdin = this.subprocess?.stdin;
    if (!stdin) {
      throw new Error("sim-server process not available");
    }
    stdin.write(command);
  }

  private saveVideoWithID(videoId: string): Promise<RecordingData> {
    const stdin = this.subprocess?.stdin;
    if (!stdin) {
      throw new Error("sim-server process not available");
    }

    let resolvePromise: (value: RecordingData) => void;
    let rejectPromise: (reason?: any) => void;
    const promise = new Promise<RecordingData>((resolve, reject) => {
      resolvePromise = resolve;
      rejectPromise = reject;
    });

    const lastPromise = this.videoRecordingPromises.get(videoId);
    if (lastPromise) {
      promise.then(lastPromise.resolve, lastPromise.reject);
    }

    const newPromiseHandler = { resolve: resolvePromise!, reject: rejectPromise! };
    this.videoRecordingPromises.set(videoId, newPromiseHandler);
    stdin.write(`video ${videoId} save\n`);
    return promise;
  }

  async start() {
    const simControllerBinary = path.join(
      extensionContext.extensionPath,
      "dist",
      Platform.select({ macos: "simulator-server-macos", windows: "simulator-server-windows.exe" })
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
        } else if (line.includes("video_ready") || line.includes("video_error")) {
          // video response format for recordings looks as follows:
          // video_ready <VIDEO_ID> <HTTP_URL> <FILE_URL>
          // video_error <VIDEO_ID> <Error message>
          const videoReadyMatch = line.match(/video_ready (\S+) (\S+) (\S+)/);
          const videoErrorMatch = line.match(/video_error (\S+) (.*)/);

          const videoId = videoReadyMatch
            ? videoReadyMatch[1]
            : videoErrorMatch
            ? videoErrorMatch[1]
            : "";

          const handlers = this.videoRecordingPromises.get(videoId);
          this.videoRecordingPromises.delete(videoId);
          if (handlers && videoReadyMatch) {
            // match array looks as follows:
            // [0] - full match
            // [1] - ID of the video
            // [2] - URL or error message
            // [3] - File URL
            const tempFileLocation = videoReadyMatch[3];
            const ext = path.extname(tempFileLocation);
            const fileName = workspace.name
              ? `${workspace.name} ${videoId}${ext}`
              : `${videoId}${ext}`;
            handlers.resolve({
              url: videoReadyMatch[2],
              tempFileLocation,
              fileName,
            });
          } else if (handlers && videoErrorMatch) {
            handlers.reject(new Error(videoErrorMatch[2]));
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
    const recordingDataPromise = this.saveVideoWithID("recording");
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
    return this.saveVideoWithID("replay");
  }

  public sendTouches(touches: Array<TouchPoint>, type: "Up" | "Move" | "Down") {
    const touchesCoords = touches.map((pt) => `${pt.xRatio},${pt.yRatio}`).join(" ");
    this.subprocess?.stdin?.write(`touch ${type} ${touchesCoords}\n`);
  }

  public sendKey(keyCode: number, direction: "Up" | "Down") {
    this.subprocess?.stdin?.write(`key ${direction} ${keyCode}\n`);
  }

  public async sendPaste(text: string) {
    this.subprocess?.stdin?.write(`paste ${text}\n`);
  }
}
