import { cleanUpAfterTest } from "../ui-tests/setupTest.js";

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
  describe(title, () => {
    after(async () => {
      await cleanUpAfterTest();
    });

    fn();
  });
}
