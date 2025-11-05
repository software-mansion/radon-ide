import { exec } from "./subprocess";

export class CancelError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export class CancelToken {
  private isCancelled = false;
  private cancelListeners: (() => void)[] = [];
  private abortController: AbortController;

  constructor() {
    this.abortController = new AbortController();
  }

  public get signal() {
    return this.abortController.signal;
  }

  public onCancel(cb: () => void) {
    this.cancelListeners.push(cb);
  }

  public adapt(input: ReturnType<typeof exec>): ReturnType<typeof exec>;
  public adapt<T>(input: Promise<T>): Promise<T>;
  public adapt<T>(
    input: Promise<T> | ReturnType<typeof exec>
  ): Promise<T> | ReturnType<typeof exec> {
    const cancelledError = new CancelError("The process was canceled");
    if (isExecaChildProcess(input)) {
      const { promise, resolve, reject } = Promise.withResolvers();
      const cancelProcess = () => {
        reject(cancelledError);
        input.kill(9);
      };

      // NOTE: if the cancel token is already cancelled,
      // we want to stop the operation immediately
      if (this.isCancelled) {
        cancelProcess();
      }

      this.onCancel(cancelProcess);

      input.then(resolve, reject);

      const wrappedInput = new Proxy(input, {
        get(target, prop, receiver) {
          if (prop === "then") {
            return (res: any, rej: any) => promise.then(res, rej);
          }
          return Reflect.get(target, prop, receiver);
        },
      });

      return wrappedInput as ReturnType<typeof exec>;
    } else {
      // NOTE: if the cancel token is already cancelled,
      // we want to stop the operation immediately
      if (this.isCancelled) {
        return Promise.reject<T>(cancelledError);
      }
      const { promise, resolve, reject } = Promise.withResolvers<T>();
      this.onCancel(() => {
        reject(cancelledError);
      });

      input.then(resolve, reject);

      return promise;
    }
  }

  public cancel() {
    this.isCancelled = true;
    this.abortController.abort();
    for (const listener of this.cancelListeners) {
      listener();
    }
  }

  get cancelled() {
    return this.isCancelled;
  }

  public throwIfCancelled() {
    if (this.cancelled) {
      throw new CancelError("The operation was cancelled");
    }
  }
}

function isExecaChildProcess(input: any): input is ReturnType<typeof exec> {
  return typeof input.kill === "function"; // ExecaChildProcess has a `kill` method
}
