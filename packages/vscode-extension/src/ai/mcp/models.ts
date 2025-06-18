import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp";

interface ImageContent {
  [x: string]: unknown;
  type: "image";
  data: string;
  mimeType: `image/${string}`;
}

interface TextContent {
  [x: string]: unknown;
  type: "text";
  text: string;
}

type ToolResponse = {
  content: (ImageContent | TextContent)[];
};

interface ToolSchema {
  name: string;
  description: string;
  inputSchema: {
    title: string;
    description: string;
    type: "object";
    properties: Record<string, { title: string; type: string }>;
    required: string[];
  };
}

interface ToolsInfo {
  tools: ToolSchema[];
}

interface ToolResult {
  tool_results: {
    content: string;
    tool_call_id: string;
  }[];
}

enum EditorType {
  CURSOR = "cursor",
  VSCODE = "vscode",
}

type McpEntry = {
  url: `http://127.0.0.1:${number}/mcp`;
  type: "http";
};

type Session = {
  sessionId: string;
  transport: StreamableHTTPServerTransport;
} | null;

export {
  EditorType,
  Session,
  McpEntry,
  TextContent,
  ToolResponse,
  ToolResult,
  ToolSchema,
  ToolsInfo,
};
