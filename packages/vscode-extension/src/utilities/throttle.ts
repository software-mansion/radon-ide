type AnyFn = (...args: any[]) => any;
type ArgsWithForce<T extends AnyFn> = [...args: Parameters<T>, force?: boolean];
type WithForce<T extends AnyFn> = (...args: ArgsWithForce<T>) => ReturnType<T>;

export function throttle<T extends AnyFn>(func: T, limitMs: number): WithForce<T> {
  let timeout: NodeJS.Timeout | null = null;
  let recentArgs: any;

  return function (...args: any) {
    const force = args[args.length - 1] === true; // Check if the last argument is true (force flag)

    if (force) {
      if (timeout !== null) {
        clearTimeout(timeout);
      }
      timeout = null;
      func(...args);
      return;
    }

    if (!timeout) {
      timeout = setTimeout(() => {
        timeout = null;
        func(...recentArgs);
        recentArgs = null;
      }, limitMs);
    }
    recentArgs = args;
  } as T;
}

type AsyncFn = (...args: any[]) => Promise<any>;

/**
 * Throttles the provided async function with the following restrictions:
 * 1) Function will never be called more than once every `limitMs` milliseconds.
 * 2) Function will never be called concurrently.
 * 3) If called multiple times, it is guaranteed that the last call with the final
 *   arguments will be executed.
 */
export function throttleAsync<T extends AsyncFn>(func: T, limitMs: number): T {
  let timeout: NodeJS.Timeout | null = null;
  let recentArgs: any;

  return async function (...args: any) {
    if (!timeout) {
      const execute = () => {
        const currentArgs = recentArgs;
        const result = func(...recentArgs);
        result
          .catch(() => {})
          .then(() => {
            if (recentArgs === currentArgs) {
              timeout = null;
              recentArgs = null;
            } else {
              // we use 0 timeout here to avoid potentially infinite nesting
              setTimeout(execute, 0);
            }
          });
      };
      timeout = setTimeout(execute, limitMs);
    }
    recentArgs = args;
  } as T;
}
