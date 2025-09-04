/**
 * Maximum memory size (in bytes) to store buffered text and image request
 * bodies.
 */
const REQUEST_BUFFER_MAX_SIZE_BYTES = 100 * 1024 * 1024; // 100MB

/**
 * A class to store network response previews keyed by requestId, with a fixed
 * memory limit. Evicts oldest responses when memory is exceeded.
 *
 * Inspired by the C++ BoundedRequestBuffer implementation from React Native.
 */
class BoundedXhrBuffer {
  private xhrMap: Map<string, XMLHttpRequest>;
  private order: string[];
  private currentSize: number;

  constructor() {
    this.xhrMap = new Map();
    this.order = [];
    this.currentSize = 0;
  }

  /**
   * Calculate the memory size of data in bytes.
   * For strings, we use UTF-8 byte length estimation.
   * @param {string} responseBody The data to measure
   * @returns {number} Size in bytes
   */
  private calculateDataSize(xhr: XMLHttpRequest): number {
    //@ts-ignore - react-native specific XMLHttpRequest property
    const maybeResponseSize = xhr._response?.size;
    if (maybeResponseSize) {
      return maybeResponseSize;
    }

    const responseBody = xhr.response;

    if (typeof responseBody === "string") {
      return new Blob([responseBody]).size;
    }
    if (responseBody instanceof ArrayBuffer) {
      return responseBody.byteLength;
    }
    if (responseBody instanceof Uint8Array) {
      return responseBody.length;
    }
    // Fallback: stringify and measure
    return new Blob([JSON.stringify(responseBody)]).size;
  }

  /**
   * Remove a request from both the responses map and order array
   * @param {string} requestId The request ID to remove
   */
  public remove(requestId: string) {
    const xhr = this.xhrMap.get(requestId);
    if (xhr) {
      this.currentSize -= this.calculateDataSize(xhr);
      this.xhrMap.delete(requestId);

      // Remove from order array
      const orderIndex = this.order.indexOf(requestId);
      if (orderIndex !== -1) {
        this.order.splice(orderIndex, 1);
      }
    }
  }

  /**
   * Store a response preview with the given requestId and data.
   * If adding the data exceeds the memory limit, removes oldest requests until
   * there is enough space or the buffer is empty.
   * @param {string} requestId Unique identifier for the request
   * @param {string|ArrayBuffer|Uint8Array} data The request preview data
   * @param {boolean} base64Encoded True if the data is base64-encoded, false otherwise
   * @returns {boolean} True if the response body was stored, false otherwise
   */
  public put(requestId: string, xhr: XMLHttpRequest): boolean {
    try {
      const dataSize = this.calculateDataSize(xhr);

      // Reject data that's too large for the entire buffer
      if (dataSize > REQUEST_BUFFER_MAX_SIZE_BYTES) {
        return false;
      }

      // Remove existing request with the same ID, if any
      if (this.xhrMap.has(requestId)) {
        this.remove(requestId);
      }

      // Evict oldest requests if necessary to make space
      while (this.currentSize + dataSize > REQUEST_BUFFER_MAX_SIZE_BYTES && this.order.length > 0) {
        const oldestId = this.order[0];
        this.remove(oldestId);
      }

      this.xhrMap.set(requestId, xhr);
      this.order.push(requestId);
      this.currentSize += dataSize;

      return true;
    } catch (error) {
      console.warn("BoundedRequestBuffer.put failed:", error);
      return false;
    }
  }

  /**
   * Retrieve a response preview by requestId.
   * @param {string} requestId The unique identifier for the request
   * @returns {XMLHttpRequest|null} The response body object if found, otherwise null
   */
  public get(requestId: string) {
    return this.xhrMap.get(requestId) || null;
  }

  /**
   * Get current buffer statistics for debugging/monitoring
   */
  public getStats() {
    return {
      entryCount: this.xhrMap.size,
      currentSizeBytes: this.currentSize,
      maxSizeBytes: REQUEST_BUFFER_MAX_SIZE_BYTES,
      utilization: ((this.currentSize / REQUEST_BUFFER_MAX_SIZE_BYTES) * 100).toFixed(2) + "%",
    };
  }
}

module.exports = { BoundedXhrBuffer, REQUEST_BUFFER_MAX_SIZE_BYTES };
