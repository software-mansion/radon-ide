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

export interface ResponseBodyData {
  body: string | undefined;
  wasTruncated: boolean;
}

export interface TimelineEvent {
  timestamp: number;
  wallTime?: number;
  durationMs?: number;
  ttfb?: number;
}

// Declared here and re-declared as object inside
// `lib/network/networkRequestParsers.ts` due to import conflicts
// inside `lib` from "src" directory
export enum ContentTypeHeader {
  IOS = "Content-Type",
  ANDROID = "content-type",
}
