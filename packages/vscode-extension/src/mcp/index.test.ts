import assert from "assert";
import { describe, it } from "mocha";
import { default as proxyquire } from "proxyquire";
import { stub } from "sinon";
import { insertRadonEntry, newMcpConfig } from "./configCreator";
import { McpConfig } from "./models";

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
  const realUrl = `http://localhost:${realPort}/sse`;
  const realType = "sse";

  const mockUrl = "https://mock-url.local/mock";
  const mockType = "mock";

  const newPort = 4321;
  const newUrl = `http://localhost:${newPort}/sse`;
  const newType = realType;

  it("should update the config", async () => {
    const config: McpConfig = { servers: {} };

    insertRadonEntry(config, realPort);

    assert.strictEqual(config.servers?.RadonAi?.url, realUrl);
    assert.strictEqual(config.servers?.RadonAi?.type, realType);
  });

  it("should not overwrite other entries", async () => {
    const config: ExtendedMcpConfig = {
      servers: {
        MockAi: {
          url: mockUrl,
          type: mockType,
        },
      },
    };

    insertRadonEntry(config, realPort);

    assert.strictEqual(config.servers?.RadonAi?.url, realUrl);
    assert.strictEqual(config.servers?.RadonAi?.type, realType);
    assert.strictEqual(config.servers?.MockAi.url, mockUrl);
    assert.strictEqual(config.servers?.MockAi.type, mockType);
  });

  it("should update existing RadonAi entry", async () => {
    const config: McpConfig = {
      servers: {
        RadonAi: {
          url: realUrl,
          type: realType,
        },
      },
    };

    insertRadonEntry(config, newPort);

    assert.strictEqual(config.servers?.RadonAi?.url, newUrl);
    assert.strictEqual(config.servers?.RadonAi?.type, newType);
  });

  it("should differenciate vscode and cursor", async () => {
    const cursorStub = stub().withArgs("cursor").returns({});
    const onCursor = proxyquire(".", {
      vscode: { workspace: { getConfiguration: () => ({ get: cursorStub }) } },
    });

    const vscodeConfig: McpConfig = newMcpConfig();
    const cursorConfig: McpConfig = onCursor.newMcpConfig();
    assert.notStrictEqual(vscodeConfig.servers, undefined);
    assert.notStrictEqual(cursorConfig.mcpServers, undefined);
  });
});
