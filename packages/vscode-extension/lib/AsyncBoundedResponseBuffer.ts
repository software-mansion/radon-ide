type ResponseBodyData = {
  body: string | undefined;
  wasTruncated: boolean;
};

type InternalResponseBodyData = ResponseBodyData & { dataSize: number };

/**
 * Maximum memory size (in bytes) to store buffered text and image request
 * bodies.
 */
const REQUEST_BUFFER_MAX_SIZE_BYTES = 100 * 1024 * 1024; // 100MB
const MAX_BODY_SIZE = 1024 * 1024; // 1 MB
const TRUNCATED_LENGTH = 1000; // 1000 characters

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
class AsyncBoundedResponseBuffer {
  private responseMap: Map<string, Promise<ResponseBodyData | undefined>>;
  private dataSizeMap: Map<string, number>;
  private order: string[];
  private currentSize: number;

  constructor(private readonly parsableContentTypes: Set<string>) {
    this.responseMap = new Map();
    this.dataSizeMap = new Map();
    this.order = [];
    this.currentSize = 0;
  }

  /**
   * Truncate and measure a response body for buffering.
   *
   * - If `responseBody` is falsy, returns an object with no body and zero size.
   * - If the serialized size of `responseBody` exceeds `MAX_BODY_SIZE`, the
   *   body is sliced to `TRUNCATED_LENGTH` characters and marked as truncated.
   * - Otherwise returns the original body and its computed byte size.
   *
   * Returns an InternalResponseBodyData containing the (possibly truncated)
   * body, a `wasTruncated` flag, and the measured `dataSize` in bytes.
   *
   * Note: size is measured using `new Blob([body]).size` to approximate
   * serialized byte length in the runtime environment.
   *
   * @param responseBody The string body to inspect and potentially truncate.
   * @returns An InternalResponseBodyData with `body`, `wasTruncated` and `dataSize`.
   */
  private truncateResponseBody(responseBody: string | undefined): InternalResponseBodyData {
    if (!responseBody) {
      return { body: undefined, wasTruncated: false, dataSize: 0 };
    }

    const dataSize = new Blob([responseBody]).size;

    if (dataSize > MAX_BODY_SIZE) {
      const slicedBody = responseBody.slice(0, TRUNCATED_LENGTH);
      return {
        body: `${slicedBody}...`,
        wasTruncated: true,
        dataSize: new Blob([slicedBody]).size,
      };
    }

    return { body: responseBody, wasTruncated: false, dataSize };
  }

  /**
   * Parse an `XMLHttpRequest` response into an InternalResponseBodyData.
   *
   * This method is async because reading `blob` response types requires a
   * FileReader. Behavior summary:
   * - If `xhr` is falsy, not cached (`_cachedResponse`) or non-parsable binary type, returns
   *   `undefined` to avoid side effects.
   * - If `responseType` is `""` or `"text"`, reads `xhr.responseText` and
   *   delegates truncation/size-measurement to `truncateResponseBody`.
   * - If `responseType` is `"blob"` and the `Content-Type` indicates a text
   *   or parsable application type reads the blob as text using FileReader (asynchronously) and
   *   then delegates to `truncateResponseBody`.
   *
   * The returned promise resolves to InternalResponseBodyData when a textual
   * preview is available, or to `undefined` when the response should not be
   * buffered.
   *
   * @param xhr The XMLHttpRequest instance to parse the response from.
   * @returns A promise resolving to an InternalResponseBodyData when a text
   * preview is available, or `undefined` for non-parsable or uncached responses.
   */
  private async parseResponseBody(
    xhr: XMLHttpRequest
  ): Promise<InternalResponseBodyData | undefined> {
    try {
      // @ts-ignore - RN-specific property
      if (!xhr || !xhr._cachedResponse) {
        // if response was not accessed, it's not cached and we don't want to read it
        // here to avoid potential side effects
        return undefined;
      }

      const responseType = xhr.responseType;

      if (responseType === "" || responseType === "text") {
        return this.truncateResponseBody(xhr.responseText);
      }

      if (responseType === "blob") {
        const contentType = xhr.getResponseHeader("Content-Type") || "";
        const isTextType = contentType.startsWith("text/");
        const isParsableApplicationType = Array.from(this.parsableContentTypes).some((type) =>
          contentType.startsWith(type)
        );

        if (isTextType || isParsableApplicationType) {
          return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => {
              const result = reader.result;
              const textResult = typeof result === "string" ? result : undefined;
              resolve(this.truncateResponseBody(textResult));
            };
            reader.onerror = (error) => {
              console.warn("Failed to read response body content:", error);
              resolve(this.truncateResponseBody(undefined));
            };
            reader.readAsText(xhr.response);
          });
        }
      }

      // don't read binary data
      return undefined;
    } catch (error) {
      console.warn("Failed to read response body content:", error);
      return undefined;
    }
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
   * @param xhr The XMLHttpRequest object to read response from
   * @returns Promise<boolean> True if the response body processing was initiated successfully
   */
  public async put(requestId: string, xhr: XMLHttpRequest): Promise<boolean> {
    try {
      // Remove existing request with the same ID, if any
      // Done to rearrange the order when re-adding the same requestId
      if (this.responseMap.has(requestId)) {
        this.remove(requestId);
      }

      const responseBodyPromise = this.parseResponseBody(xhr);

      // Store the promise immediately. When it resolves, handle size and eviction.
      this.responseMap.set(
        requestId,
        responseBodyPromise.then((response) =>
          response ? { body: response.body, wasTruncated: response.wasTruncated } : undefined
        )
      );
      this.order.push(requestId);

      // Handle the response when it resolves
      const response = await responseBodyPromise;

      // Check if the request was removed while we were processing
      if (!response || !this.responseMap.has(requestId)) {
        return false;
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
