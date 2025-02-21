type RetryFn<T> = (retryNumber: number, retriesLeft: number) => Promise<T>;

export async function retry<T>(fn: RetryFn<T>, retries = 5, interval = 1000): Promise<T> {
  async function call(retriesLeft: number) {
    try {
      return await fn(retries - (retriesLeft - 1), retriesLeft);
    } catch (error) {
      if (retriesLeft > 0) {
        await sleep(interval);
        return call(retriesLeft - 1);
      } else {
        throw error;
      }
    }
  }

  return await call(retries);
}

export const progressiveRetryValue = (retryNumber: number) => Math.min(100 * Math.max(retryNumber, 1), 1000);

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
