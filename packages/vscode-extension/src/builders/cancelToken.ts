import { exec } from "../utilities/subprocess";

export class CancelToken {
  private isCancelled = false;
  private cancelListeners: (() => void)[] = [];

  public onCancel(cb: () => void) {
    this.cancelListeners.push(cb);
  }

  private isExecaChildProcess(input: any): input is ReturnType<typeof exec> {
    return typeof input.kill === "function"; // ExecaChildProcess has a `kill` method
  }

  public adapt(input: ReturnType<typeof exec>): ReturnType<typeof exec>;
  public adapt<T>(input: Promise<T>): Promise<T>;
  public adapt<T>(
    input: Promise<T> | ReturnType<typeof exec>
  ): Promise<T> | ReturnType<typeof exec> {
    if (this.isExecaChildProcess(input)) {
      // Handle ExecaChildProcess
      this.onCancel(() => input.kill(9));
      return input;
    } else {
      // Handle Promise
      const { promise, resolve, reject } = Promise.withResolvers<T>();
      this.onCancel(() => {
        reject("The process was canceled");
      });

      input.then(resolve).catch(reject);

      return promise;
    }
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
