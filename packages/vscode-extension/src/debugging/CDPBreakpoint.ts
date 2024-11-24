import { Breakpoint } from "@vscode/debugadapter";
import { SourceMapsRegistry } from "./SourceMapsRegistry";
import { CDPSession } from "./CDPSession";

function makeDeferredTaskPromise<T>(task: () => Promise<T>) {
  let resolve: (value: T | PromiseLike<T>) => void;
  let reject: (reason?: any) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  const runTask = () => {
    task().then(resolve, reject);
  };
  return { promise, runTask };
}

let breakpointId = 0;

export class CDPBreakpoint extends Breakpoint {
  private cdpId: number | undefined;
  private lastTaskPromise = Promise.resolve();

  constructor(
    private cdpSession: CDPSession,
    private sourceMapController: SourceMapsRegistry,
    private sourcePath: string,
    public readonly line: number,
    public readonly column: number | undefined
  ) {
    super(false, line, column);
  }

  public delete() {
    return this.scheduleTask(this.deleteWithCDP);
  }

  public async reset() {
    this.delete();
    return this.set();
  }

  public set() {
    return this.scheduleTask(this.setWithCDP);
  }

  private setWithCDP = async () => {
    if (this.verified) {
      return;
    }

    const generatedPos = this.sourceMapController.toGeneratedPosition(
      this.sourcePath,
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
      this.cdpId = result.breakpointId;
      this.verified = true;
      this.setId(breakpointId++);
    } else {
      this.verified = false;
    }
  };

  private deleteWithCDP = async () => {
    await this.cdpSession.sendCDPMessage("Debugger.removeBreakpoint", {
      breakpointId: this.cdpId,
    });
    this.verified = false;
  };

  private async scheduleTask(task: () => Promise<void>) {
    const { promise, runTask } = makeDeferredTaskPromise(task);
    if (this.lastTaskPromise) {
      this.lastTaskPromise
        .catch(() => {}) // no-op catch hereo allow the next task to run
        .then(() => {
          setTimeout(runTask, 0);
        });
    } else {
      runTask();
    }
    this.lastTaskPromise = promise;
    return promise;
  }
}
