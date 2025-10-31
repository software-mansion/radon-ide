export interface ImageContent {
  [x: string]: unknown;
  type: "image";
  data: string;
  mimeType: `image/${string}`;
}

export interface TextContent {
  [x: string]: unknown;
  type: "text";
  text: string;
}

export type ToolResponse = {
  content: (ImageContent | TextContent)[];
};

export interface ToolSchema {
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

export interface ToolsInfo {
  tools: ToolSchema[];
}

export interface ToolResult {
  tool_results: {
    content: string;
    tool_call_id: string;
  }[];
}

// Extracted from `react-devtools-shared/src/frontend/types`
export type DevtoolsElement = {
  id: number;
  parentID: number;
  children: Array<number>;
  type: number;
  displayName: string | null;
  key: number | string | null;
  hocDisplayNames: null | Array<string>;
  isCollapsed: boolean;
  ownerID: number;
  depth: number;
  weight: number;
  isStrictModeNonCompliant: boolean;
  compiledWithForget: boolean;
};
