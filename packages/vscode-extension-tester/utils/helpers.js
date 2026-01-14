import { cleanUpAfterTest } from "../ui-tests/setupTest.js";
import { get } from "../ui-tests/setupTest.js";
import getConfiguration from "../configuration.js";
import startRecording from "./screenRecording.js";

let globalRetryCount = 0;
const GLOBAL_RETRY_LIMIT = 15;
const IS_RECORDING = getConfiguration().IS_RECORDING;

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
    before(() => {
      const { driver } = get();
      if (IS_RECORDING)
        this.recorder = startRecording(
          driver,
          title.replace(/\s+/g, "_") || "test"
        );
    });
    beforeEach(function () {
      if (this.currentTest && this.currentTest.currentRetry() > 0) {
        globalRetryCount++;
      }
      if (globalRetryCount > GLOBAL_RETRY_LIMIT) {
        this.currentTest?.retries(0);
      }
    });
    after(async () => {
      if (IS_RECORDING && this.recorder) this.recorder.stop();
      await cleanUpAfterTest();
    });

    fn();
  });
}
