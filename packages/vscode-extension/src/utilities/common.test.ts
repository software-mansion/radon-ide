import process from "process";
import assert from "assert";
import sinon from "sinon";
import { after, test } from "mocha";
import { ABI, getNativeABI } from "./common";

after(() => {
  sinon.restore();
});

test("getNativeABI()", function () {
  stubIntelArch();

  assert.equal(getNativeABI(), ABI.X86);
});

function stubIntelArch() {
  sinon.stub(process, "arch").value("ia32");
}
