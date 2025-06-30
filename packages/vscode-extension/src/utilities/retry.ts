import { CancelError, CancelToken } from "./cancelToken";

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

export const progressiveRetryTimeout = (retryNumber: number) =>
  Math.min(100 * Math.max(retryNumber, 1), 1000);

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type Cancellable = Parameters<CancelToken["adapt"]>[0];
/**
 * Executes a given asynchronous function with retry logic, supporting cancellation.
 *
 * @param fn - A function that returns a `Cancellable` operation to be executed.
 * @param retries - The number of times to retry the operation upon failure.
 * @param cancelToken - A `CancelToken` used to signal cancellation and adapt promises.
 * @throws {CancelError} Throws if the operation is cancelled.
 * @throws {Error} Throws if the operation fails after all retries.
 */
export async function cancellableRetry(
  fn: () => Cancellable,
  cancelToken: CancelToken,
  retries: number = 5,
  interval: number = 1000
) {
  while (!cancelToken.cancelled && retries-- > 0) {
    try {
      await cancelToken.adapt(fn());
      return;
    } catch (error) {
      if (error instanceof CancelError) {
        throw error; // rethrow the cancel error to be handled by the caller
      }
      if (retries === 0) {
        throw error;
      }
      await cancelToken.adapt(sleep(interval));
    }
  }
}
