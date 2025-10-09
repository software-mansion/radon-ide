import assert from "assert";
import { describe, it } from "mocha";

import { extractFilePath } from "./customBuild";

describe("customBuild", () => {
  describe("extractFilePath", () => {
    it("should extract quoted path with spaces", () => {
      const result = extractFilePath(`Path: "/Users/me/My App.app"`);
      assert.equal(result, "/Users/me/My App.app");
    });

    it("should extract Windows path with single quotes", () => {
      const result = extractFilePath(`Installing 'C:\\Program Files\\AppFolder\\App.apk'...`);
      assert.equal(result, "C:\\Program Files\\AppFolder\\App.apk");
    });

    it("should extract relative path with tar.gz", () => {
      const result = extractFilePath(`Archive created at ./builds/output.tar.gz`);
      assert.equal(result, "./builds/output.tar.gz");
    });

    it("should extract absolute app under dot directory with spaces without quotes", () => {
      const result = extractFilePath("/Users/johndoe/.builds/builds/app-3aabf66a76gggg/My App.app");
      assert.equal(result, "/Users/johndoe/.builds/builds/app-3aabf66a76gggg/My App.app");
    });

    it("should extract quoted absolute app under dot directory with spaces", () => {
      const result = extractFilePath(
        '"/Users/johndoe/.builds/builds/app-3aabf66a76gggg/My App.app"'
      );
      assert.equal(result, "/Users/johndoe/.builds/builds/app-3aabf66a76gggg/My App.app");
    });

    it("should return null when no path is present", () => {
      const result = extractFilePath(`No path here`);
      assert.equal(result, null);
    });

    it("should extract unquoted absolute path", () => {
      const result = extractFilePath(`Build output: /tmp/build/MyApp.app`);
      assert.equal(result, "/tmp/build/MyApp.app");
    });

    it("should extract Windows path with single quotes and additional text", () => {
      const result = extractFilePath(`'C:\\Users\\Test\\App.apk' installed successfully`);
      assert.equal(result, "C:\\Users\\Test\\App.apk");
    });

    it("should extract quoted relative path", () => {
      const result = extractFilePath(`Creating archive: "builds/release.tar.gz"`);
      assert.equal(result, "builds/release.tar.gz");
    });

    it("should return null for text without valid extensions", () => {
      const result = extractFilePath(`No valid file extensions here`);
      assert.equal(result, null);
    });

    it("should return null for invalid file extension", () => {
      const result = extractFilePath(`/Users/johndow/notes.txt`);
      assert.equal(result, null);
    });

    it("should extract path with dot-directory", () => {
      const result = extractFilePath(`Build output: /tmp/.hidden/build/MyApp.app`);
      assert.equal(result, "/tmp/.hidden/build/MyApp.app");
    });

    it("should extract quoted path with dot-directory", () => {
      const result = extractFilePath(`Archive: "./.build/output.tar.gz"`);
      assert.equal(result, "./.build/output.tar.gz");
    });

    it("should extract Windows path with dot-directory", () => {
      const result = extractFilePath(`Installing 'C:\\.hidden\\AppFolder\\App.apk'...`);
      assert.equal(result, "C:\\.hidden\\AppFolder\\App.apk");
    });

    it("should extract single-quoted path with spaces", () => {
      const result = extractFilePath(`Path: '/Users/me/My App.app'`);
      assert.equal(result, "/Users/me/My App.app");
    });

    it("should extract single-quoted relative path", () => {
      const result = extractFilePath(`Archive created at './builds/output.tar.gz'`);
      assert.equal(result, "./builds/output.tar.gz");
    });

    it("should extract unquoted path with spaces", () => {
      const result = extractFilePath(`Build output: /tmp/my build/MyApp.app`);
      assert.equal(result, "/tmp/my build/MyApp.app");
    });

    it("should extract unquoted relative path with spaces", () => {
      const result = extractFilePath(`Archive created at ./my builds/output.tar.gz`);
      assert.equal(result, "./my builds/output.tar.gz");
    });

    it("should extract unquoted Windows path with spaces", () => {
      const result = extractFilePath(`Installing C:\\Program Files\\AppFolder\\App.apk...`);
      assert.equal(result, "C:\\Program Files\\AppFolder\\App.apk");
    });
  });
});
