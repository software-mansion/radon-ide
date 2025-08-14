import path from "path";
import { Disposable, workspace } from "vscode";
import { exec, ChildProcess, lineReader } from "../utilities/subprocess";
import { Logger } from "../Logger";
import { MultimediaData, TouchPoint, DeviceButtonType, DeviceRotation } from "../common/Project";
import { simulatorServerBinary } from "../utilities/simulatorServerBinary";
import { watchLicenseTokenChange } from "../utilities/license";
import { disposeAll } from "../utilities/disposables";

interface MultimediaPromiseHandlers {
  resolve: (value: MultimediaData) => void;
  reject: (reason?: any) => void;
}

enum MultimediaType {
  Video = "video",
  Screenshot = "screenshot",
}

type FramerateReport = {
  fps: number;
  received: number;
  dropped: number;
  timestamp: number;
};

export class Preview implements Disposable {
  private disposables: Disposable[] = [];
  private multimediaPromises = new Map<string, MultimediaPromiseHandlers>();
  private subprocess?: ChildProcess;
  private tokenChangeListener?: Disposable;
  private fpsReportListener?: (report: FramerateReport) => void;
  public streamURL?: string;
  private replaysStarted = false;

  constructor(private args: string[]) { }

  dispose() {
    disposeAll(this.disposables);
  }

  private sendCommandOrThrow(command: string) {
    const stdin = this.subprocess?.stdin;
    if (!stdin) {
      throw new Error("sim-server process not available");
    }
    stdin.write(command);
  }

  private saveMultimediaWithID(
    type: MultimediaType,
    id: string,
    rotation: DeviceRotation
  ): Promise<MultimediaData> {
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
    stdin.write(`${type} ${id} ${type === "video" ? "save " : ""}-r ${rotation}\n`);
    return promise;
  }

  async start() {
    const simControllerBinary = simulatorServerBinary();

    Logger.debug(`Launch preview ${simControllerBinary} ${this.args}`);

    const subprocess = exec(simControllerBinary, this.args, {
      buffer: false,
    });
    this.subprocess = subprocess;
    this.disposables.push(new Disposable(() => subprocess.kill()));

    this.tokenChangeListener = watchLicenseTokenChange((token) => {
      if (token) {
        this.sendCommandOrThrow(`token ${token}\n`);
      }
    });
    this.disposables.push(this.tokenChangeListener);

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
        } else if (line.includes("fps_report")) {
          // the frame rate report format is as follows:
          // fps_report {"fps":number ,"received":number,"dropped":number,"timestamp":number}
          const frameRateRegex = /fps_report\s+(\{.*\})/;
          const match = line.match(frameRateRegex);
          if (!match) {
            return;

          }
          const jsonString = match[1];
          let frameRateData: FramerateReport;
          try{
            frameRateData = JSON.parse(jsonString) as FramerateReport;
          } catch (error) {
            Logger.error("[Preview] Error parsing frame rate JSON:", error);
            return;
          }
          if(!this.fpsReportListener){
            Logger.warn("[Preview] No FPS report listener registered but received frame rate data, this should not be reachable.");
            return;
          }
          this.fpsReportListener(frameRateData);

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

  public startFrameRateReporting(onFpsReport: (report: FramerateReport) => void) {
    this.subprocess?.stdin?.write("fps true\n");
    this.fpsReportListener = onFpsReport;
  }

  public stopFrameRateReporting() {
    this.subprocess?.stdin?.write("fps false\n");
    this.fpsReportListener = undefined;
  }

  public setUpKeyboard() {
    this.subprocess?.stdin?.write("setUpKeyboard\n");
  }

  public showTouches() {
    this.subprocess?.stdin?.write("pointer show true\n");
  }

  public hideTouches() {
    this.subprocess?.stdin?.write("pointer show false\n");
  }

  public rotateDevice(rotation: DeviceRotation) {
    this.subprocess?.stdin?.write(`rotate ${rotation}\n`, (err) => {
      if (err) {
        Logger.error("sim-server: Error rotating device:", err);
        throw new Error(`Failed to rotate device: ${err.message}`);
      }
      Logger.info(`sim-server: device rotated to ${rotation}`);
    });
  }

  public startRecording() {
    this.sendCommandOrThrow(`video recording start -b 2000\n`); // 2000MB buffer for on-disk video
  }

  public captureAndStopRecording(rotation: DeviceRotation) {
    const recordingDataPromise = this.saveMultimediaWithID(
      MultimediaType.Video,
      "recording",
      rotation
    );
    this.sendCommandOrThrow(`video recording stop\n`);
    return recordingDataPromise;
  }

  public startReplays() {
    if (!this.replaysStarted) {
      // starting replay if one was already started will crop the previous buffer
      // we therefore need to check if a replay is already started
      this.replaysStarted = true;
      this.sendCommandOrThrow(`video replay start -m -b 50\n`); // 50MB buffer for in-memory video
    }
  }

  public stopReplays() {
    // we don't need to check if replay was already stopped because the stop command is idempotent
    this.replaysStarted = false;
    this.sendCommandOrThrow(`video replay stop\n`);
  }

  public captureReplay(rotation: DeviceRotation) {
    return this.saveMultimediaWithID(MultimediaType.Video, "replay", rotation);
  }

  public captureScreenShot(rotation: DeviceRotation) {
    return this.saveMultimediaWithID(MultimediaType.Screenshot, "screenshot", rotation);
  }

  public sendTouches(
    touches: Array<TouchPoint>,
    type: "Up" | "Move" | "Down",
    rotation: DeviceRotation
  ) {
    // transform touch coordinates to account for different device orientations before
    // translation and sending them to the simulator-server.
    const transformedTouches = touches.map((touch, i) => {
      const { xRatio: x, yRatio: y } = touch;
      switch (rotation) {
        // 90° anticlockwise map (x,y) to (1-y, x)
        case DeviceRotation.LandscapeLeft:
          return { xRatio: 1 - y, yRatio: x };
        case DeviceRotation.LandscapeRight:
          // 90° clockwise map (x,y) to (y, 1-x)
          return { xRatio: y, yRatio: 1 - x };
        case DeviceRotation.PortraitUpsideDown:
          // 180° map (x,y) to (1-x, 1-y)
          return { xRatio: 1 - x, yRatio: 1 - y };
        default:
          // Portrait mode: no transformation needed
          return touch;
      }
    });

    const touchesCoords = transformedTouches.map((pt) => `${pt.xRatio},${pt.yRatio}`).join(" ");
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
