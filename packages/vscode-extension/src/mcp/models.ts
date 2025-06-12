interface ImageContent {
  type: "image";
  data: string;
  mimeType: `image/${string}`;
  model_config?: {
    extra: "allow";
  };
}

interface TextContent {
  type: "text";
  text: string;
}

type ToolResponse = Promise<
  | string
  | {
      content: (ImageContent | TextContent)[];
      isError?: boolean;
    }
>;

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
  url: `http://localhost:${number}/sse`;
  type: "sse";
};

export { EditorType, McpEntry, TextContent, ToolResponse, ToolResult, ToolSchema, ToolsInfo };
