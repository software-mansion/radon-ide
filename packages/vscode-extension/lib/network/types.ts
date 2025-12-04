/**
 * Shared types for network interception and request/response handling.
 * Used across XHR interceptor, Fetch interceptor, and request parsers.
 */

/**
 * Network proxy interface for sending messages to the IDE.
 */
export interface NetworkProxy {
  sendMessage: (channel: string, message: string) => void;
}

/**
 * Extended XMLHttpRequest interface with React Native specific properties,
 * as it adds internal properties prefixed with underscore for tracking
 * request/response metadata.
 * See: https://github.com/facebook/react-native/blob/main/packages/react-native/Libraries/Network/XMLHttpRequest.js
 */
export interface ExtendedXMLHttpRequest extends XMLHttpRequest {
  _url?: string;
  _method?: string;
  _headers?: Record<string, string>;
  _response?: ArrayBuffer | Blob | string | null | { size?: number; length?: number };
  _aborted?: boolean;
  _error?: boolean;
  responseHeaders?: Record<string, string>;
}

/**
 * Serialized TypedArray representation, gotten from XHRInterceptor
 */
export interface SerializedTypedArray {
  length: number;
  [key: number]: number;
  [Symbol.iterator](): Iterator<number>;
}

/**
 * Union type representing possible request data formats.
 * Can be a string, serialized typed array, null (empty body), or a plain object.
 */
export type RequestData = string | SerializedTypedArray | null | object;

/**
 * Response body data type classification.
 * Based on resourceTypeFromMimeType method in React Native's implementation.
 */
export enum ResponseBodyDataType {
  Media = "Media",
  Image = "Image",
  Script = "Script",
  XHR = "XHR",
  Other = "Other",
}

export interface InternalResponseBodyData {
  body: string | undefined;
  wasTruncated: boolean;
  base64Encoded: boolean;
  type: ResponseBodyDataType;
  dataSize: number;
}

/**
 * Response body data without the internal size tracking.
 */
export type ResponseBodyData = Omit<InternalResponseBodyData, "dataSize">;

/**
 * The casing in Content-Type header differs on android and iOS,
 * so this is used in the workaround.
 */
export const ContentTypeHeader = {
  Default: "Content-Type",
  LowerCase: "content-type",
} as const;

/**
 * Used to determine how to process request/response data based on MIME type.
 */
export interface ContentTypeAnalysis {
  isImageType: boolean;
  isOctetStream: boolean;
  isTextType: boolean;
  isParsableApplicationType: boolean;
}

/**
 * Native response type for React Native fetch polyfill.
 */
export type NativeResponseType = "text" | "blob" | "base64";

/**
 * Blob-like response object from React Native.
 * Used as a Blob representation in RN when dealing with network responses.
 */
export interface BlobLikeResponse {
  size: number;
  type: string;
  blobId: number;
  name: string;
  offset: number;
}

export const DEFAULT_RESPONSE_BODY_DATA = {
  body: undefined,
  wasTruncated: false,
  base64Encoded: false,
  type: ResponseBodyDataType.Other,
  dataSize: 0,
};
