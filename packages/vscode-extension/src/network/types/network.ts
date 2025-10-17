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
  url?: string;
  encodedDataLength?: number;
}

export interface NetworkRequestInitiator {
  type: "parser" | "script" | "preload" | "SignedExchange" | "preflight" | "other";
  sourceUrl?: string;
  lineNumber?: number;
  columnNumber?: number;
  stack?: unknown;
}

export interface GetResponseBodyResponse {
  result: {
    body: string | undefined;
    base64Encoded: boolean;
  };
}

// Redeclared in lib/network/networkRequestParsers.ts
export enum ResponseBodyDataType {
  Media = "Media",
  Image = "Image",
  Script = "Script",
  XHR = "XHR",
  Other = "Other",
}

export interface ResponseBody {
  body: string | undefined;
  base64Encoded: boolean;
}

export interface ResponseBodyData extends ResponseBody {
  type: ResponseBodyDataType;
  fullBody?: string;
  wasTruncated?: boolean;
}

export interface TimelineEvent {
  timestamp?: number;
  wallTime?: number;
  durationMs?: number;
  ttfb?: number;
  downloadTime?: number;
}

// Declared here and re-declared as object inside
// `lib/network/networkRequestParsers.ts` due to import conflicts
// inside `lib` from "src" directory
export enum ContentTypeHeader {
  Default = "Content-Type",
  LowerCase = "content-type",
}
