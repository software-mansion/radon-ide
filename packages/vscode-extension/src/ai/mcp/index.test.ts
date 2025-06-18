import assert from "assert";
import { describe, it } from "mocha";
import { default as proxyquire } from "proxyquire";
import { stub } from "sinon";
import sinon from "sinon";
import { insertRadonEntry, newMcpConfig } from "./configCreator";

// jsonc-parser by default builds a UMD bundle that esbuild can't resolve.
const { parse }: typeof import("jsonc-parser/lib/esm/main") = require("jsonc-parser");

type ExtendedMcpConfig = {
  servers?: Record<
    string,
    {
      url: string;
      type: string;
    }
  >;
};

describe("creatingMcpConfig", () => {
  const realPort = 1234;
  const realUrl = `http://127.0.0.1:${realPort}/mcp`;
  const realType = "http";

  const mockUrl = "https://mock-url.local/mock";
  const mockType = "mock";

  const newPort = 4321;
  const newUrl = `http://127.0.0.1:${newPort}/mcp`;
  const newType = realType;

  it("should update the config", async () => {
    const empty = JSON.stringify({ servers: {} });
    const updated = insertRadonEntry(empty, realPort);

    const config = parse(updated);

    assert.strictEqual(config.servers?.RadonAi?.url, realUrl);
    assert.strictEqual(config.servers?.RadonAi?.type, realType);
  });

  it("should not overwrite other entries", async () => {
    const populated: ExtendedMcpConfig = {
      servers: {
        MockAi: {
          url: mockUrl,
          type: mockType,
        },
      },
    };

    const serialized = JSON.stringify(populated);
    const updated = insertRadonEntry(serialized, realPort);
    const config = parse(updated);

    assert.strictEqual(config.servers?.RadonAi?.url, realUrl);
    assert.strictEqual(config.servers?.RadonAi?.type, realType);
    assert.strictEqual(config.servers?.MockAi.url, mockUrl);
    assert.strictEqual(config.servers?.MockAi.type, mockType);
  });

  it("should update existing RadonAi entry", async () => {
    const stale: ExtendedMcpConfig = {
      servers: {
        RadonAi: {
          url: realUrl,
          type: realType,
        },
      },
    };

    const serialized = JSON.stringify(stale);
    const updated = insertRadonEntry(serialized, newPort);
    const config = parse(updated);

    assert.strictEqual(config.servers?.RadonAi?.url, newUrl);
    assert.strictEqual(config.servers?.RadonAi?.type, newType);
  });

  it("should differenciate vscode and cursor", async () => {
    const cursorStub = stub().withArgs("cursor").returns({});
    const onCursor = proxyquire("./configCreator", {
      "./utils": proxyquire("./utils", {
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
});
