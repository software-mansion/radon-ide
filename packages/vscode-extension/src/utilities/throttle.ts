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
