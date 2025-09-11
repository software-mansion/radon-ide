import assert from "assert";
import { describe, beforeEach, it } from "mocha";
import { InternalResponseBodyData } from "./networkRequestParsers";
import { AsyncBoundedResponseBuffer as AsyncBuffer } from "./AsyncBoundedResponseBuffer";

const {
  AsyncBoundedResponseBuffer,
  REQUEST_BUFFER_MAX_SIZE_BYTES,
} = require("./AsyncBoundedResponseBuffer");

describe("AsyncBoundedResponseBuffer", () => {
  let buffer: AsyncBuffer;

  beforeEach(() => {
    buffer = new AsyncBoundedResponseBuffer();
  });

  describe("constructor", () => {
    it("should initialize with empty state", () => {
      const stats = buffer.getStats();
      assert.strictEqual(stats.entryCount, 0);
      assert.strictEqual(stats.currentSizeBytes, 0);
      assert.strictEqual(stats.maxSizeBytes, REQUEST_BUFFER_MAX_SIZE_BYTES);
      assert.strictEqual(stats.utilization, "0.00%");
    });
  });

  describe("put and get operations", () => {
    it("should store and retrieve response data", async () => {
      const requestId = "test-request-1";
      const responseData: InternalResponseBodyData = {
        body: "test response body",
        wasTruncated: false,
        dataSize: 100,
      };

      const result = await buffer.put(requestId, Promise.resolve(responseData));
      assert.strictEqual(result, true);

      const retrievedPromise = buffer.get(requestId);
      assert(retrievedPromise !== undefined);

      const retrieved = await retrievedPromise;
      assert.deepStrictEqual(retrieved, {
        body: "test response body",
        wasTruncated: false,
      });
    });

    it("should handle undefined response data", async () => {
      const requestId = "test-request-undefined";

      const result = await buffer.put(requestId, Promise.resolve(undefined));
      assert.strictEqual(result, false);

      const retrievedPromise = buffer.get(requestId);

      const retrieved = await retrievedPromise;
      assert.strictEqual(retrieved, undefined);
    });

    it("should return undefined for non-existent requestId", () => {
      const retrievedPromise = buffer.get("non-existent");
      assert.strictEqual(retrievedPromise, undefined);
    });
  });

  it("should remove data after it was retrieved (one-time access)", async () => {
    const requestId1 = "test-request-1";
    const responseData1: InternalResponseBodyData = {
      body: "test response body",
      wasTruncated: false,
      dataSize: 100,
    };

    const requestId2 = "test-request-2";
    const responseData2 = undefined;

    const result1 = await buffer.put(requestId1, Promise.resolve(responseData1));
    const result2 = await buffer.put(requestId2, Promise.resolve(responseData2));
    assert.strictEqual(result1, true);
    assert.strictEqual(result2, false);

    const retrievedPromise1 = buffer.get(requestId1);
    const retrievedPromise2 = buffer.get(requestId2);
    assert(retrievedPromise1 !== undefined);
    assert(retrievedPromise2 === undefined);

    assert.strictEqual(result1, buffer.get(requestId1));
    assert.strictEqual(result2, buffer.get(requestId2));

    const stats = buffer.getStats();
    assert.strictEqual(stats.entryCount, 0);
    assert.strictEqual(stats.currentSizeBytes, 0);
  });

  describe("memory management and eviction", () => {
    it("should track memory usage correctly", async () => {
      const requestId1 = "test-request-memory-1";
      const requestId2 = "test-request-memory-2";
      const dataSize1 = 1000;
      const dataSize2 = 2000;

      await buffer.put(
        requestId1,
        Promise.resolve({
          body: "body1",
          wasTruncated: false,
          dataSize: dataSize1,
        })
      );

      await buffer.put(
        requestId2,
        Promise.resolve({
          body: "body2",
          wasTruncated: false,
          dataSize: dataSize2,
        })
      );

      const stats = buffer.getStats();
      assert.strictEqual(stats.currentSizeBytes, dataSize1 + dataSize2);
      assert.strictEqual(stats.entryCount, 2);
    });

    it("should evict oldest entries when memory limit exceeded", async () => {
      // Create a response that equals the buffer limit
      const largeDataSize = REQUEST_BUFFER_MAX_SIZE_BYTES;
      const smallDataSize = 1000;

      const oldestId = "oldest-request";
      const middleId = "middle-request";
      const newestId = "newest-request";

      await buffer.put(
        oldestId,
        Promise.resolve({
          body: "oldest body",
          wasTruncated: false,
          dataSize: smallDataSize,
        })
      );

      await buffer.put(
        middleId,
        Promise.resolve({
          body: "middle body",
          wasTruncated: false,
          dataSize: smallDataSize,
        })
      );

      // Add large entry that should trigger eviction
      await buffer.put(
        newestId,
        Promise.resolve({
          body: "large body",
          wasTruncated: false,
          dataSize: largeDataSize,
        })
      );

      // Oldest and middle entries should be evicted
      assert.strictEqual(buffer.get(oldestId), undefined);
      assert.strictEqual(buffer.get(middleId), undefined);

      // Newest entry should still be available
      const newestPromise = buffer.get(newestId);
      assert(newestPromise !== undefined);

      const newest = await newestPromise;
      assert.strictEqual(newest?.body, "large body");
    });

    it("should not evict the current request during eviction", async () => {
      // This tests the safety check in the eviction logic
      const largeDataSize = REQUEST_BUFFER_MAX_SIZE_BYTES + 1000;
      const currentId = "current-request";
      const currentData = {
        body: "current body",
        wasTruncated: false,
        dataSize: largeDataSize,
      };

      const result = await buffer.put(currentId, Promise.resolve(currentData));

      assert.strictEqual(result, true);

      const currentPromise = buffer.get(currentId);
      assert(currentPromise !== undefined);
    });
  });

  describe("request id replacement", () => {
    it("should replace existing request with same id and update order", async () => {
      const firstDataSize = 1000;
      const secondDataSize = 2000;
      const requestId = "duplicate-request";
      const firstData = {
        body: "first body",
        wasTruncated: false,
        dataSize: firstDataSize,
      };
      const secondData = {
        body: "second body",
        wasTruncated: false,
        dataSize: secondDataSize,
      };

      // Add first response
      await buffer.put(requestId, Promise.resolve(firstData));

      let stats = buffer.getStats();
      assert.strictEqual(stats.currentSizeBytes, firstDataSize);
      assert.strictEqual(stats.entryCount, 1);

      // Replace with second response
      await buffer.put(requestId, Promise.resolve(secondData));

      stats = buffer.getStats();
      assert.strictEqual(stats.currentSizeBytes, secondDataSize);
      assert.strictEqual(stats.entryCount, 1);

      // Should get the second response
      const retrievedPromise = buffer.get(requestId);
      assert(retrievedPromise !== undefined);

      const retrieved = await retrievedPromise;
      assert.strictEqual(retrieved?.body, "second body");
    });
  });

  describe("error handling", () => {
    it("should handle rejected promises and clean up", async () => {
      const requestId = "failing-request";
      const errorMessage = "Request failed";

      const result = await buffer.put(requestId, Promise.reject(new Error(errorMessage)));
      assert.strictEqual(result, false);

      // Entry should not exist after error
      const retrievedPromise = buffer.get(requestId);
      assert.strictEqual(retrievedPromise, undefined);

      const stats = buffer.getStats();
      assert.strictEqual(stats.entryCount, 0);
      assert.strictEqual(stats.currentSizeBytes, 0);
    });

    it("should handle concurrent removal during promise resolution", async () => {
      const requestId = "concurrent-request";
      let resolvePromise: (value: InternalResponseBodyData) => void;

      const responsePromise = new Promise<InternalResponseBodyData>((resolve) => {
        resolvePromise = resolve;
      });

      const putPromise = buffer.put(requestId, responsePromise);

      // Remove the request before the promise resolves
      buffer.remove(requestId);

      resolvePromise!({
        body: "concurrent body",
        wasTruncated: false,
        dataSize: 1000,
      });

      const result = await putPromise;
      assert.strictEqual(result, false);

      const stats = buffer.getStats();
      assert.strictEqual(stats.entryCount, 0);
      assert.strictEqual(stats.currentSizeBytes, 0);
    });
  });

  describe("remove method", () => {
    it("should remove existing entries and update memory usage", async () => {
      const requestId = "test-remove";
      const dataSize = 1500;
      const responseData = {
        body: "test body",
        wasTruncated: false,
        dataSize,
      };

      await buffer.put(requestId, Promise.resolve(responseData));

      let stats = buffer.getStats();
      assert.strictEqual(stats.entryCount, 1);
      assert.strictEqual(stats.currentSizeBytes, dataSize);

      buffer.remove(requestId);

      stats = buffer.getStats();
      assert.strictEqual(stats.entryCount, 0);
      assert.strictEqual(stats.currentSizeBytes, 0);

      const retrievedPromise = buffer.get(requestId);
      assert.strictEqual(retrievedPromise, undefined);
    });

    it("should handle removal of non-existent entries", () => {
      // Should not throw
      buffer.remove("non-existent");

      const stats = buffer.getStats();
      assert.strictEqual(stats.entryCount, 0);
      assert.strictEqual(stats.currentSizeBytes, 0);
    });
  });
});
