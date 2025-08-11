import assert from "assert";
import { describe, it } from "mocha";
import { CircularBuffer } from "./CircularBuffer";

describe("CircularBuffer", () => {
  const bufferCapacity = 5;
  const amountOfTestLoops = 3;

  it("should return the correct output", async () => {
    const buffer = new CircularBuffer<number>(bufferCapacity);
    let bufferSize = 0;

    for (let i = 0; i < bufferCapacity * amountOfTestLoops; i++) {
      buffer.write(i);
      bufferSize = Math.min(bufferSize + 1, bufferCapacity);

      const contents = buffer.readAll();

      for (let j = 0; j < bufferSize; j++) {
        const expectedValue = i - j;
        const actualValue = contents[bufferSize - j - 1];

        assert.strictEqual(expectedValue, actualValue);
      }
    }
  });

  it("should clear properly", async () => {
    const buffer = new CircularBuffer<number>(bufferCapacity);

    for (let i = 0; i < bufferCapacity * amountOfTestLoops; i++) {
      buffer.write(i);
    }

    buffer.clear();

    const contents = buffer.readAll();

    assert.strictEqual(contents.length, 0);
  });
});
