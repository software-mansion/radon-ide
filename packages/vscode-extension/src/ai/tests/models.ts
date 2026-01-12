export interface ChatData {
  requests: Request[];
}

export interface Request {
  response: Response[];
}

export type Response = ToolCallResponse | UnknownResponse;

export interface UnknownResponse {
  // `Exclude<string, "literal">` resolves to `string` (does not work)
  kind: unknown;
}

export type AllowedToolId =
  | "query_documentation"
  | "view_screenshot"
  | "view_component_tree"
  | "view_application_logs"
  | "reload_application";

export interface ToolCallResponse {
  kind: "toolInvocationSerialized";
  toolId: AllowedToolId;
}

export interface ChatTestCase {
  prompt: string;
  allowedToolIds: AllowedToolId[];
}

export interface ChatTestResult {
  prompt: string;
  success: boolean;
  cause: string | null;
}
