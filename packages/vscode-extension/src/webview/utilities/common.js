export function throttle(func, limit) {
  let timeout;
  let recentArgs;

  return function (...args) {
    const force = args[args.length - 1] === true; // Check if the last argument is true (force flag)

    if (force) {
      timeout = null;
      clearTimeout(timeout);
      func(...args);
      return;
    }

    if (!timeout) {
      timeout = setTimeout(() => {
        timeout = null;
        func(...recentArgs);
        recentArgs = null;
      }, limit);
    }
    recentArgs = args;
  };
}
