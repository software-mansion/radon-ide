import { InternalResponseBodyData } from "./networkRequestParsers";
type ResponseBodyData = Omit<InternalResponseBodyData, "dataSize">;

/**
 * Maximum memory size (in bytes) to store buffered text and image request
 * bodies.
 */
const REQUEST_BUFFER_MAX_SIZE_BYTES = 100 * 1024 * 1024; // 100MB

/**
 * An asynchronous buffer to store network response previews keyed by requestId,
 * with a fixed memory limit. Evicts oldest responses when memory is exceeded.
 *
 * All operations are asynchronous as response body reading requires async
 * operations (e.g., reading blob content as text).
 *
 * The Buffer is One-Time-Access - once a response is retrieved with `get`,
 * it is removed from the buffer to free up space. The frontend needs to fetch
 * response body only once per request.
 *
 * Inspired by the C++ BoundedRequestBuffer implementation from React Native.
 */
export class AsyncBoundedResponseBuffer {
  private responseMap: Map<string, Promise<ResponseBodyData | undefined>>;
  private dataSizeMap: Map<string, number>;
  private order: string[];
  private currentSize: number;

  constructor() {
    this.responseMap = new Map();
    this.dataSizeMap = new Map();
    this.order = [];
    this.currentSize = 0;
  }

  /**
   * Remove a request from the buffer and update memory usage.
   * @param requestId The request ID to remove
   */
  public remove(requestId: string): void {
    const hasResponse = this.responseMap.has(requestId);
    const responseSize = this.dataSizeMap.get(requestId) || 0;

    if (hasResponse) {
      this.responseMap.delete(requestId);

      // Remove from order array
      const orderIndex = this.order.indexOf(requestId);
      if (orderIndex !== -1) {
        this.order.splice(orderIndex, 1);
      }
    }

    if (responseSize > 0) {
      this.currentSize -= responseSize;
      this.dataSizeMap.delete(requestId);
    }
  }

  /**
   * Store a promise with response preview asynchronously using the given requestId as key.
   * If adding the data exceeds the memory limit, remove oldest requests until
   * there is enough space or the buffer is empty.
   *
   * @param requestId Unique identifier for the request
   * @param responseBodyDataPromise The response body data promise object, with parsed data from xhr response
   * @returns Promise<boolean> True if the response body processing was initiated successfully
   */
  public async put(
    requestId: string,
    responseBodyDataPromise: Promise<InternalResponseBodyData | undefined>
  ): Promise<boolean> {
    try {
      // Remove existing request with the same ID, if any
      // Done to rearrange the order when re-adding the same requestId
      if (this.responseMap.has(requestId)) {
        this.remove(requestId);
      }

      const storedPromise = responseBodyDataPromise
        .then((response) => {
          if (!response) {
            return undefined;
          }

          const { dataSize: _dataSize, ...responseBodyData } = response || {};
          return responseBodyData;
        })
        .catch((error) => {
          console.warn("Error processing response body for requestId", requestId, error);
          return undefined;
        });

      this.responseMap.set(requestId, storedPromise);
      this.order.push(requestId);

      // Handle the response when it resolves
      const response = await responseBodyDataPromise;

      // Check if the request was removed while we were processing
      if (this.responseMap.get(requestId) !== storedPromise) {
        return false;
      }

      // Do not keep track of empty responses, negligible size
      if (!response) {
        return true;
      }

      const dataSize = response.dataSize;
      this.currentSize += dataSize;
      this.dataSizeMap.set(requestId, dataSize);

      // Evict oldest requests if necessary to make space
      while (
        this.currentSize > REQUEST_BUFFER_MAX_SIZE_BYTES &&
        this.order.length > 1 // Keep at least the current request
      ) {
        const oldestId = this.order[0];
        if (oldestId !== requestId) {
          this.remove(oldestId);
        } else {
          break; // Safety check to avoid infinite loop
        }
      }

      return true;
    } catch (error) {
      console.warn("BoundedXhrBuffer.put failed:", error);
      // Clean up on error
      this.remove(requestId);
      return false;
    }
  }

  /**
   * Retrieve a response preview by requestId asynchronously.
   * @param requestId The unique identifier for the request
   * @returns Promise that resolves to ResponseBodyData if found, undefined otherwise
   */
  public get(requestId: string): Promise<ResponseBodyData | undefined> | undefined {
    const responsePromise = this.responseMap.get(requestId);
    // One-Time_Access - Remove the entry once accessed to free up space
    if (responsePromise) {
      this.remove(requestId);
    }
    return responsePromise;
  }

  /**
   * Get current buffer statistics for debugging/monitoring
   * @returns Object containing buffer utilization statistics
   */
  public getStats(): {
    entryCount: number;
    currentSizeBytes: number;
    maxSizeBytes: number;
    utilization: string;
  } {
    return {
      entryCount: this.responseMap.size,
      currentSizeBytes: this.currentSize,
      maxSizeBytes: REQUEST_BUFFER_MAX_SIZE_BYTES,
      utilization: ((this.currentSize / REQUEST_BUFFER_MAX_SIZE_BYTES) * 100).toFixed(2) + "%",
    };
  }
}

module.exports = {
  AsyncBoundedResponseBuffer,
  REQUEST_BUFFER_MAX_SIZE_BYTES,
};
