export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "OPTIONS" | "HEAD";

export interface RequestData {
  url: string;
  method: HttpMethod;
  headers?: Record<string, string>;
  postData?: string;
}

export interface RequestOptions {
  method: HttpMethod;
  headers: Record<string, string>;
  body?: string;
}

export interface ResponseData {
  type: string;
  status: number;
  statusText: string;
  headers?: Record<string, string>;
  content?: unknown;
  mimeType?: string;
}

export interface NetworkRequestInitiator {
  sourceUrl: string;
  lineNumber: number;
  columnNumber: number;
}

export interface GetResponseBodyResponse {
  result: {
    body: string;
    base64Encoded: boolean;
  };
}

export interface ResponseBodyData {
  body: string | undefined;
  wasTruncated?: boolean;
}

export interface TimelineEvent {
  timestamp: number;
  wallTime?: number;
  durationMs?: number;
  ttfb?: number;
}
