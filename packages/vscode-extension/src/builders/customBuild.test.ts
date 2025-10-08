import assert from "assert";
import { describe, it } from "mocha";

import { extractFilePath } from "./customBuild";

describe("customBuild", () => {
  describe("extractFilePath", () => {
    it("should extract file paths from various formats and edge cases", () => {
      const testCases = [
        {
          input: `Path: "/Users/me/My App.app"`,
          expected: "/Users/me/My App.app",
          description: "quoted path with spaces",
        },
        {
          input: `Installing 'C:\\Program Files\\AppFolder\\App.apk'...`,
          expected: "C:\\Program Files\\AppFolder\\App.apk",
          description: "Windows path with single quotes",
        },
        {
          input: `Archive created at ./builds/output.tar.gz`,
          expected: "./builds/output.tar.gz",
          description: "relative path with tar.gz",
        },
        {
          input: "/Users/johndoe/.builds/builds/app-3aabf66a76gggg/My App.app",
          expected: "/Users/johndoe/.builds/builds/app-3aabf66a76gggg/My App.app",
          description: "absolite app under dot directory with spaces without quotes",
        },
        {
          input: '"/Users/johndoe/.builds/builds/app-3aabf66a76gggg/My App.app"',
          expected: "/Users/johndoe/.builds/builds/app-3aabf66a76gggg/My App.app",
          description: "absolite app under dot directory with spaces without quotes",
        },
        {
          input: `No path here`,
          expected: null,
          description: "no path present",
        },
        {
          input: `Build output: /tmp/build/MyApp.app`,
          expected: "/tmp/build/MyApp.app",
          description: "unquoted absolute path",
        },
        {
          input: `'C:\\Users\\Test\\App.apk' installed successfully`,
          expected: "C:\\Users\\Test\\App.apk",
          description: "Windows path with single quotes and additional text",
        },
        {
          input: `Creating archive: "builds/release.tar.gz"`,
          expected: "builds/release.tar.gz",
          description: "quoted relative path",
        },
        {
          input: `No valid file extensions here`,
          expected: null,
          description: "text without valid extensions",
        },
        {
          input: `/Users/johndow/notes.txt`,
          expected: null,
          description: "invalid file extension",
        },
        // Dot-directory tests
        {
          input: `Build output: /tmp/.hidden/build/MyApp.app`,
          expected: "/tmp/.hidden/build/MyApp.app",
          description: "path with dot-directory",
        },
        {
          input: `Archive: "./.build/output.tar.gz"`,
          expected: "./.build/output.tar.gz",
          description: "quoted path with dot-directory",
        },
        {
          input: `Installing 'C:\\.hidden\\AppFolder\\App.apk'...`,
          expected: "C:\\.hidden\\AppFolder\\App.apk",
          description: "Windows path with dot-directory",
        },
        // Single quote tests
        {
          input: `Path: '/Users/me/My App.app'`,
          expected: "/Users/me/My App.app",
          description: "single-quoted path with spaces",
        },
        {
          input: `Archive created at './builds/output.tar.gz'`,
          expected: "./builds/output.tar.gz",
          description: "single-quoted relative path",
        },
        // Unquoted paths with spaces
        {
          input: `Build output: /tmp/my build/MyApp.app`,
          expected: "/tmp/my build/MyApp.app",
          description: "unquoted path with spaces",
        },
        {
          input: `Archive created at ./my builds/output.tar.gz`,
          expected: "./my builds/output.tar.gz",
          description: "unquoted relative path with spaces",
        },
        {
          input: `Installing C:\\Program Files\\AppFolder\\App.apk...`,
          expected: "C:\\Program Files\\AppFolder\\App.apk",
          description: "unquoted Windows path with spaces",
        },
      ];

      testCases.forEach(({ input, expected, description }) => {
        const result = extractFilePath(input);
        assert.equal(result, expected, `Failed for ${description}: "${input}"`);
      });
    });
  });
});
