import { Breakpoint, Source } from "@vscode/debugadapter";
import { SourceMapController } from "./SourceMapsController";
import { Logger } from "../Logger";
import { CDPSession } from "./CDPSession";

export class CDPBreakpoint extends Breakpoint {
  public readonly line: number;
  public readonly column: number | undefined;
  private _id: number | undefined;
  private executingQueue: boolean = false;
  private cdpCommunicationQueue: Array<() => Promise<void>> = [];

  constructor(
    private cdpSession: CDPSession,
    private sourceMapController: SourceMapController,
    verified: boolean,
    line: number,
    column?: number,
    source?: Source
  ) {
    super(verified, line, column, source);
    this.column = column;
    this.line = line;
  }

  public async delete() {
    return this.addTaskToQueue(async () => {
      await this.deleteCDPBreakpoint();
    });
  }

  public reset(sourceMapPath: string) {
    return this.addTaskToQueue(async () => {
      await this.resetCDPBreakpoint(sourceMapPath);
    });
  }

  public async add(sourcePath: string) {
    return this.addTaskToQueue(async () => {
      await this.setCDPBreakpoint(sourcePath);
    });
  }

  public setId(id: number): void {
    super.setId(id);
    this._id = id;
  }

  public getId(): number | undefined {
    // we cannot use `get id` here, because Breakpoint actually has a private field
    // called id, and it'd collide with this getter making it impossible to set it
    return this._id;
  }

  private async resetCDPBreakpoint(sourceMapPath: string) {
    if (this.verified) {
      await this.cdpSession.sendCDPMessage("Debugger.removeBreakpoint", {
        breakpointId: this.getId(),
      });
      this.verified = false;
    }
    await this.setCDPBreakpoint(sourceMapPath);
  }

  private async setCDPBreakpoint(sourcePath: string) {
    if (this.verified) {
      return;
    }

    const generatedPos = this.sourceMapController.toGeneratedPosition(
      sourcePath,
      this.line,
      this.column ?? 0
    );
    if (!generatedPos) {
      return;
    }

    const result = await this.cdpSession.sendCDPMessage("Debugger.setBreakpointByUrl", {
      // in CDP line and column numbers are 0-based
      lineNumber: generatedPos.lineNumber1Based - 1,
      url: generatedPos.source,
      columnNumber: generatedPos.columnNumber0Based,
      condition: "",
    });
    if (result && result.breakpointId !== undefined) {
      this.setId(result.breakpointId);
      this.verified = true;
    }
  }

  private async deleteCDPBreakpoint() {
    await this.cdpSession.sendCDPMessage("Debugger.removeBreakpoint", {
      breakpointId: this.getId(),
    });
  }

  private executeCommunication() {
    if (!this.executingQueue && this.cdpCommunicationQueue.length > 0) {
      this.executingQueue = true;
      this.executeNextTask();
    }
  }

  private executeNextTask() {
    if (this.cdpCommunicationQueue.length === 0) {
      this.executingQueue = false;
      return;
    }

    const task = this.cdpCommunicationQueue.shift();
    task!()
      .then(() => {
        this.executeNextTask();
      })
      .catch((err) => {
        Logger.warn("Error executing task on breakpoint:", this.getId(), err);
        this.executeNextTask();
      });
  }

  private async addTaskToQueue(task: () => Promise<void>) {
    return new Promise<void>((res, rej) => {
      this.cdpCommunicationQueue.push(() => {
        return new Promise<void>((resolve) => {
          task().finally(() => {
            resolve();
            res();
          });
        });
      });
      this.executeCommunication();
    });
  }
}
