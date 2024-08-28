import { exec } from "../utilities/subprocess";

export class CancelToken {
  private isCancelled = false;
  private cancelListeners: (() => void)[] = [];

  public onCancel(cb: () => void) {
    this.cancelListeners.push(cb);
  }

  public adapt(execResult: ReturnType<typeof exec>) {
    this.onCancel(() => execResult.kill(9));
    return execResult;
  }

  public cancel() {
    this.isCancelled = true;
    for (const listener of this.cancelListeners) {
      listener();
    }
  }

  get cancelled() {
    return this.isCancelled;
  }
}
