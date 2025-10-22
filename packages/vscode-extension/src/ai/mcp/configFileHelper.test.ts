import assert from "assert";
import { describe, it } from "mocha";
import { removeOldRadonEntryFromConfig } from "./configFileHelper";

// jsonc-parser by default builds a UMD bundle that esbuild can't resolve.
const { parse }: typeof import("jsonc-parser/lib/esm/main") = require("jsonc-parser");

type ExtendedMcpConfig = {
  servers?: Record<
    string,
    {
      url?: string;
      type?: string;
      headers?: Record<string, string>;
      command?: string;
      args?: string[];
    }
  >;
};

describe("MCP Config File Helper", () => {
  it("should return undefined if no changes are needed", async () => {
    const populated: ExtendedMcpConfig = {
      servers: {
        MockAi: {
          url: "http://something.org",
          type: "http",
        },
      },
    };

    const serialized = JSON.stringify(populated);
    const updated = removeOldRadonEntryFromConfig(serialized);
    assert.equal(updated, undefined);
  });

  it("should not remove RadonAi entry when pointing to stdio MCP", async () => {
    const stale: ExtendedMcpConfig = {
      servers: {
        RadonAi: {
          command: "npx",
          args: ["-y", "radon-mcp@latest", "${workspaceFolder}"],
        },
      },
    };

    const serialized = JSON.stringify(stale);
    const updated = removeOldRadonEntryFromConfig(serialized);
    assert.equal(updated, undefined);
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
    const updated = removeOldRadonEntryFromConfig(serialized);
    const config = parse(updated!);

    // Old entry should be removed
    assert.equal(config.servers?.RadonAi, undefined);
    // Other entries should remain
    assert.equal(config.servers?.OtherService.url, "http://other.service");
    assert.equal(config.servers?.OtherService.type, "http");
  });
});
