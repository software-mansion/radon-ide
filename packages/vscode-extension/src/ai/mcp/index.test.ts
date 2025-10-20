import assert from "assert";
import { describe, it } from "mocha";
import { default as proxyquire } from "proxyquire";
import { stub } from "sinon";
import sinon from "sinon";
import {
  insertRadonEntry,
  newMcpConfig,
  removeRadonEntry,
  removeOldRadonEntry,
} from "./configCreator";

// jsonc-parser by default builds a UMD bundle that esbuild can't resolve.
const { parse }: typeof import("jsonc-parser/lib/esm/main") = require("jsonc-parser");

type ExtendedMcpConfig = {
  servers?: Record<
    string,
    {
      url: string;
      type: string;
      headers?: Record<string, string>;
    }
  >;
};

describe("creatingMcpConfig", () => {
  it("should update the config", async () => {
    const empty = JSON.stringify({ servers: {} });
    const updated = insertRadonEntry(empty);

    const config = parse(updated!);

    assert.equal(config.servers?.RadonAI?.command, "npx");
    assert.deepStrictEqual(config.servers?.RadonAI?.args, [
      "-y",
      "radon-mcp@latest",
      "${workspaceFolder}",
    ]);
  });

  it("should not overwrite other entries", async () => {
    const populated: ExtendedMcpConfig = {
      servers: {
        MockAi: {
          url: "http://something.org",
          type: "http",
        },
      },
    };

    const serialized = JSON.stringify(populated);
    const updated = insertRadonEntry(serialized);
    const config = parse(updated!);

    assert.equal(config.servers?.RadonAI?.command, "npx");
    assert.deepStrictEqual(config.servers?.RadonAI?.args, [
      "-y",
      "radon-mcp@latest",
      "${workspaceFolder}",
    ]);
    assert.equal(config.servers?.MockAi.url, "http://something.org");
    assert.equal(config.servers?.MockAi.type, "http");
  });

  it("should update existing RadonAi entry", async () => {
    const stale: ExtendedMcpConfig = {
      servers: {
        RadonAI: {
          url: "http://old.radon.ai",
          type: "http",
        },
      },
    };

    const serialized = JSON.stringify(stale);
    const updated = insertRadonEntry(serialized);
    const config = parse(updated!);

    assert.equal(config.servers?.RadonAI?.command, "npx");
    assert.deepStrictEqual(config.servers?.RadonAI?.args, [
      "-y",
      "radon-mcp@latest",
      "${workspaceFolder}",
    ]);
  });

  it("should differenciate vscode and cursor", async () => {
    const cursorStub = stub().withArgs("cursor").returns({});
    const onCursor = proxyquire("./configCreator", {
      "../../utilities/editorType": proxyquire("../../utilities/editorType", {
        vscode: { workspace: { getConfiguration: () => ({ get: cursorStub }) } },
      }),
    });

    const vscodeText = newMcpConfig();
    const cursorText = onCursor.newMcpConfig();

    const vscodeConfig = parse(vscodeText);
    const cursorConfig = parse(cursorText);

    sinon.assert.calledOnce(cursorStub);
    assert.notDeepStrictEqual(cursorConfig, vscodeConfig);
  });

  it("should remove old RadonAi entry", async () => {
    const configWithOldEntry: ExtendedMcpConfig = {
      servers: {
        RadonAi: {
          url: "http://old.radon.ai",
          type: "http",
        },
        OtherService: {
          url: "http://other.service",
          type: "http",
        },
      },
    };

    const serialized = JSON.stringify(configWithOldEntry);
    const updated = removeOldRadonEntry(serialized);
    const config = parse(updated!);

    // Old entry should be removed
    assert.equal(config.servers?.RadonAi, undefined);
    // Other entries should remain
    assert.equal(config.servers?.OtherService.url, "http://other.service");
    assert.equal(config.servers?.OtherService.type, "http");
  });

  it("should return undefined when no changes are needed", async () => {
    const emptyConfig = JSON.stringify({ servers: {} });

    // Test insertRadonEntry when config already has the correct entry
    const configWithCorrectEntry = JSON.stringify({
      servers: {
        RadonAI: {
          command: "npx",
          args: ["-y", "radon-mcp@latest", "${workspaceFolder}"],
        },
      },
    });

    assert.equal(insertRadonEntry(configWithCorrectEntry), undefined);

    // Test removeRadonEntry when entry doesn't exist
    assert.equal(removeRadonEntry(emptyConfig), undefined);

    // Test removeOldRadonEntry when old entry doesn't exist
    assert.equal(removeOldRadonEntry(emptyConfig), undefined);
  });
});
