import { cleanUpAfterTest } from "../ui-tests/setupTest.js";

let globalRetryCount = 0;
const GLOBAL_RETRY_LIMIT = 10;

export function centerCoordinates(position) {
  return {
    x: position.x - 0.5,
    y: position.y - 0.5,
    width: position.width,
    height: position.height,
  };
}

export function describeIf(condition, title, fn) {
  if (condition) {
    safeDescribe(title, fn);
  } else {
    describe.skip(title, fn);
  }
}

export function itIf(condition, title, fn) {
  if (condition) {
    it(title, fn);
  } else {
    it.skip(title, fn);
  }
}

export function safeDescribe(title, fn) {
  describe(title, function () {
    this.retries(2);
    beforeEach(function () {
      if (this.currentTest && this.currentTest.currentRetry() > 0) {
        globalRetryCount++;
      }
      if (globalRetryCount > GLOBAL_RETRY_LIMIT) {
        this.currentTest?.retries(0);
      }
    });
    after(async () => {
      await cleanUpAfterTest();
    });

    fn();
  });
}
