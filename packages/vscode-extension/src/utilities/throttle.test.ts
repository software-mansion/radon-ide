import assert from "assert";
import sinon from "sinon";
import { describe, it, before, after } from "mocha";
import { throttleAsync } from "./throttle";

describe("throttleAsync", () => {
  let clock: sinon.SinonFakeTimers;

  before(() => {
    clock = sinon.useFakeTimers({ shouldClearNativeTimers: true });
  });
  after(() => {
    clock.restore();
  });

  it("executes the function after timeout", () => {
    let resolved = false;
    const throttled = throttleAsync(async () => {
      resolved = true;
    }, 1000);
    throttled();

    assert.equal(resolved, false);
    clock.tick(1100);
    assert.equal(resolved, true);
  });
  it("executes the function immediately when flushed", () => {
    let resolved = false;
    const throttled = throttleAsync(async () => {
      resolved = true;
    }, 1000);
    throttled();
    throttled.flush();
    clock.tick(0);

    assert.equal(resolved, true);
  });
  it("never executes the function when cancelled", () => {
    let resolved = false;
    const throttled = throttleAsync(async () => {
      resolved = true;
    }, 1000);
    throttled();
    throttled.cancel();
    clock.tick(1100);

    assert.equal(resolved, false);
  });

  it("executes the function only once when called multiple times within the limit", () => {
    let callCount = 0;
    const throttled = throttleAsync(async () => {
      callCount++;
    }, 1000);
    throttled();
    throttled();
    throttled();
    clock.tick(1100);

    assert.equal(callCount, 1);
  });

  it("executes the function multiple times when called multiple times outside the limit", async () => {
    let callCount = 0;
    const throttled = throttleAsync(async () => {
      callCount++;
    }, 1000);
    throttled();
    await clock.tickAsync(1100);
    throttled();
    throttled();
    await clock.tickAsync(1100);
    throttled();
    throttled();
    await clock.tickAsync(1100);

    assert.equal(callCount, 3);
  });

  it("executes the function when flushed while the async operation is running", async () => {
    let lastArgCalled: number | null = null;
    let lastArgFinished: number | null = null;
    const { promise, resolve } = Promise.withResolvers<void>();
    const throttled = throttleAsync(async (arg) => {
      lastArgCalled = arg;
      await promise;
      lastArgFinished = arg;
    }, 1000);

    throttled(1);
    await clock.tickAsync(1100);
    assert.equal(lastArgCalled, 1);
    assert.equal(lastArgFinished, null);

    throttled(2);
    throttled.flush();
    resolve();
    await clock.tickAsync(0);

    assert.equal(lastArgCalled, 2);
    assert.equal(lastArgFinished, 2);
  });
});
