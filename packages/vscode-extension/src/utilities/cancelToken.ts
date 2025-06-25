import { exec } from "./subprocess";

export class CancelError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export class CancelToken {
  private isCancelled = false;
  private cancelListeners: (() => void)[] = [];

  public onCancel(cb: () => void) {
    this.cancelListeners.push(cb);
  }

  public adapt(input: ReturnType<typeof exec>): ReturnType<typeof exec>;
  public adapt<T>(input: Promise<T>): Promise<T>;
  public adapt<T>(
    input: Promise<T> | ReturnType<typeof exec>
  ): Promise<T> | ReturnType<typeof exec> {
    if (isExecaChildProcess(input)) {
      const { promise, resolve, reject } = Promise.withResolvers();

      this.onCancel(() => {
        reject(new CancelError("The process was canceled"));
        input.kill(9);
      });

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
      const { promise, resolve, reject } = Promise.withResolvers<T>();
      this.onCancel(() => {
        reject(new CancelError("The process was canceled"));
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

function isExecaChildProcess(input: any): input is ReturnType<typeof exec> {
  return typeof input.kill === "function"; // ExecaChildProcess has a `kill` method
}
