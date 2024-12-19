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
 *   arguments will be executed and that the function will run *after* the last
 *   call is made.
 */
export function throttleAsync<T extends AsyncFn>(func: T, limitMs: number): T {
  let isScheduled = false;
  let recentArgs: any;
  let callCount = 0;

  return async function (...args: any) {
    if (!isScheduled) {
      const execute = () => {
        const currentCallCount = callCount;
        const result = func(...recentArgs);
        result
          .catch(() => {})
          .then(() => {
            if (currentCallCount === callCount) {
              isScheduled = false;
              recentArgs = null;
            } else {
              // If call count has changed while the function was executing,
              // we need to run it again to ensure we run the function with the
              // latest arguments and after the latest call.
              // We use setTimeout to avoid potentially infinite recursion, and
              // to ensure the function is not run more often than once every
              // `limitMs` milliseconds, we schedule it to run after the provided
              // limit.
              setTimeout(execute, limitMs);
            }
          });
      };
      isScheduled = true;
      setTimeout(execute, limitMs);
    }
    recentArgs = args;
    callCount++;
  } as T;
}
