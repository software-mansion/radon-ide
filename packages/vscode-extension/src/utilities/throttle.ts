import assert from "assert";

type AsyncFn = (...args: any[]) => Promise<any>;
type ThrottledAsyncFn<T extends AsyncFn> = T & { cancel: () => void; flush: () => void };

/**
 * Throttles the provided async function with the following restrictions:
 * 1) Function will never be called more than once every `limitMs` milliseconds.
 * 2) Function will never be called concurrently.
 * 3) If called multiple times, it is guaranteed that the last call with the final
 *   arguments will be executed and that the function will run *after* the last
 *   call is made.
 */
export function throttleAsync<T extends AsyncFn>(
  func: T,
  limitMs: number
): ThrottledAsyncFn<(...args: Parameters<T>) => Promise<void>> {
  let timeoutId: NodeJS.Timeout | null = null;
  let recentArgs: Parameters<T> | null = null;
  let running = false;
  let wasFlushed = false;

  function isScheduled() {
    return recentArgs !== null;
  }

  function execute() {
    unschedule();
    if (recentArgs === null) {
      return;
    }
    assert(!running, "Throttled function is never called concurrently");
    const args = recentArgs;
    recentArgs = null;

    running = true;
    const result = func(...args);
    result
      .catch(() => {})
      .then(() => {
        running = false;
        if (isScheduled()) {
          // If call count has changed while the function was executing,
          // we need to run it again to ensure we run the function with the
          // latest arguments and after the latest call.
          // We use setTimeout to avoid potentially infinite recursion, and
          // to ensure the function is not run more often than once every
          // `limitMs` milliseconds, we schedule it to run after the provided
          // limit.
          timeoutId = setTimeout(execute, wasFlushed ? 0 : limitMs);
          wasFlushed = false;
        }
      });
  }

  const throttledFunction = async function (...args: Parameters<T>) {
    if (!running && !isScheduled()) {
      timeoutId = setTimeout(execute, limitMs);
    }
    recentArgs = args;
  };

  function unschedule() {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    timeoutId = null;
  }

  throttledFunction.cancel = () => {
    unschedule();
    recentArgs = null;
  };

  throttledFunction.flush = () => {
    if (running) {
      // NOTE: if the throttled function is currently executing,
      // we want to execute the last invocation immediately after it finished,
      // which we do by simply setting the flag
      wasFlushed = true;
      return;
    }

    // NOTE: otherwise, execute immediately
    execute();
  };

  return throttledFunction;
}
