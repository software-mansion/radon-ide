import { TextDecoder } from "../polyfills";

// Due to import conflicts from "src" directory, some types
// are redeclared here from src/network/types/network.ts

// Redeclared in src/network/types/network.ts
// Based on resourceTypeFromMimeType method in React-Native's resourceTypyFromMimeType
enum ResponseBodyDataType {
  Media = "Media",
  Image = "Image",
  Script = "Script",
  XHR = "XHR",
  Other = "Other",
}

export type InternalResponseBodyData = {
  body: string | undefined;
  wasTruncated: boolean;
  base64Encoded: boolean;
  type: ResponseBodyDataType;
  dataSize: number;
};

// Redeclared here from definition in
// src/network/typesc/network.ts
export const ContentTypeHeader = {
  Default: "Content-Type",
  LowerCase: "content-type",
} as const;

interface SerializedTypedArray {
  length: number;
  [key: number]: number;
  [Symbol.iterator](): Iterator<number>;
}

function isSerializedTypedArray(obj: unknown): obj is SerializedTypedArray {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
    return false;
  }
  const record = obj as Record<string, unknown>;
  // length may exist but not be a number, so check safely
  if (typeof record.length !== "number") {
    return false;
  }
  return Object.keys(record).every((key) => !isNaN(parseInt(key, 10)));
}

type RequestData = string | SerializedTypedArray | null | object;

type FormDataObject = { _parts: Array<[string, unknown]> };

function isFormDataObject(obj: unknown): obj is FormDataObject {
  if (!obj || typeof obj !== "object") {
    return false;
  }
  const record = obj as Record<string, unknown>;
  return Array.isArray(record._parts);
}

// Allowed content types for processing text-based data
const PARSABLE_APPLICATION_CONTENT_TYPES = new Set([
  // Shell scripts
  "application/x-sh",
  "application/x-csh",

  // JSON variants
  "application/json",
  "application/manifest+json",
  "application/ld+json",

  // JavaScript variants
  "application/javascript",
  "application/ecmascript",
  "application/x-ecmascript",
  "application/x-javascript",

  // XML variants
  "application/xml",
  "application/xhtml+xml",
  "application/xul",

  // Other text-based formats
  "application/yaml",
  "application/rtf",
  "application/x-httpd-php",
  "application/vnd.dart",
]);

/**
 * Maximum memory size (in bytes) to store buffered text and image request
 * bodies.
 */
const MAX_BODY_SIZE = 1024 * 1024; // 1 MB
const TRUNCATED_LENGTH = 1000; // 1000 characters

const DEFAULT_RESPONSE_BODY_DATA = {
  body: undefined,
  wasTruncated: false,
  base64Encoded: false,
  type: ResponseBodyDataType.Other,
  dataSize: 0,
};

/**
 * Parse data gotten from Network.getResponseBody, truncate if needed and measure the body for buffering.
 *
 * - Add metadata fields defined in IDE.getResponseBodyData method,
 * - If `responseBody` is falsy, returns an object with no body, zero size and default metadata values.
 * - If the serialized size of `responseBody` exceeds `MAX_BODY_SIZE`, the
 *   body is sliced to `TRUNCATED_LENGTH` characters and marked as truncated.
 * - Otherwise returns the original body, its computed byte size and metadata
 *
 * Returns an InternalResponseBodyData containing the (possibly truncated)
 * body, a `wasTruncated` flag, and the measured `dataSize` in bytes.
 *
 * Note: size is measured using `new Blob([body]).size` to approximate
 * serialized byte length in the runtime environment.
 *
 * @param responseBody The string body to inspect and potentially truncate.
 * @returns An InternalResponseBodyData with `body`, `wasTruncated` and `dataSize`.
 */
function parseResponseBodyData(
  responseBody: string | undefined,
  base64Encoded: boolean = false,
  type: ResponseBodyDataType = ResponseBodyDataType.Other
): InternalResponseBodyData {
  if (!responseBody) {
    return DEFAULT_RESPONSE_BODY_DATA;
  }

  const dataSize = new Blob([responseBody]).size;

  if (dataSize > MAX_BODY_SIZE) {
    const slicedBody = responseBody.slice(0, TRUNCATED_LENGTH);
    return {
      body: slicedBody,
      wasTruncated: true,
      base64Encoded,
      type,
      dataSize: new Blob([slicedBody]).size,
    };
  }

  return { body: responseBody, base64Encoded, wasTruncated: false, type, dataSize };
}

function handleReadResponseError(error: unknown): InternalResponseBodyData {
  console.warn("Failed to read response body content:", error);
  return parseResponseBodyData(undefined);
}

/**
 * Image and octet-stream handling.
 */
function readBlobAsBase64(blob: Blob, isImage?: boolean): Promise<InternalResponseBodyData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      let textResult: string | undefined;
      if (reader.result instanceof ArrayBuffer) {
        const uint8Array = new Uint8Array(reader.result);
        textResult = dataToBase64(uint8Array);
      } else if (typeof reader.result === "string") {
        textResult = reader.result;
      }

      const type = isImage ? ResponseBodyDataType.Image : ResponseBodyDataType.Other;

      resolve(parseResponseBodyData(textResult, true, type));
    };

    reader.onerror = (error) => {
      reject(error);
    };

    reader.readAsArrayBuffer(blob);
  });
}

/**
 * Text and parsable application types handling.
 */
function readBlobAsText(blob: Blob): Promise<InternalResponseBodyData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = reader.result;
      const textResult = typeof result === "string" ? result : undefined;
      resolve(parseResponseBodyData(textResult, false, ResponseBodyDataType.Other));
    };

    reader.onerror = (error) => {
      reject(error);
    };

    reader.readAsText(blob);
  });
}

/**
 * Parse an `XMLHttpRequest` response into an InternalResponseBodyData.
 *
 * This method is async because reading `blob` response types requires a
 * FileReader. Behavior summary:
 * - If `xhr` is falsy, or the responsebody is non-parsable binary type, returns
 *   `undefined` to avoid side effects.
 * - If `responseType` is `""` or `"text"`, reads `xhr.responseText` and
 *   delegates truncation/size-measurement to `parseResponseBodyData`.
 * - If `responseType` is `"json"`, stringifies `xhr.response` and
 *   delegates to `parseResponseBodyData`.
 * - If `responseType` is `"blob"`:
 *   - For images or octet-streams: reads as base64 via FileReader
 *   - For text/parsable types: reads as text via FileReader
 *   - Otherwise returns `undefined` (binary data not buffered)
 * - If `responseType` is `"arraybuffer"`:
 *   - For images or octet-streams: converts Uint8Array to base64
 *   - For text/parsable types: decodes Uint8Array to text
 *   - Otherwise returns `undefined` (binary data not buffered)
 * - `responseType` "document" is not supported by XHRInterceptor in React Native.
 *
 * React Native XHR Implementation Details:
 * - For empty/text responseType: returns '' if not DONE state, response text otherwise
 * - For other responseTypes returns null until DONE, then transforms and caches in _cachedResponse:
 *   - "arraybuffer": ArrayBuffer via base64.toByteArray().buffer
 *   - "blob": Blob via BlobManager.createFromOptions()
 *   - "json": parsed JSON (or null on parse error)
 *   - "document": always null (unsupported)
 *
 * More details: https://github.com/facebook/react-native/blob/main/packages/react-native/Libraries/Network/XMLHttpRequest.js
 *
 * By default, using 'fetch' in React Native uses polyfill, which always
 * sets the responseType to 'blob' or 'arraybuffer', whichever is supported (so usually blob).
 *
 * More details: https://github.com/JakeChampion/fetch/blob/main/fetch.js
 *
 * The returned promise resolves to InternalResponseBodyData when a textual
 * preview is available, or to `undefined` when the response should not be
 * buffered.
 *
 * @param xhr The XMLHttpRequest instance to parse the response from.
 * @returns A promise resolving to an InternalResponseBodyData when a text
 * preview is available, or `undefined` for non-parsable or uncached responses.
 */
async function readResponseText(
  xhr: XMLHttpRequest
): Promise<InternalResponseBodyData | undefined> {
  try {
    if (!xhr) {
      // if response was not accessed, it's not cached and we don't want to read it
      // here to avoid potential side effects
      return undefined;
    }

    const responseType = xhr.responseType;

    if (responseType === "" || responseType === "text") {
      return await parseResponseBodyData(xhr.responseText ?? xhr.response);
    }

    if (responseType === "json") {
      return await parseResponseBodyData(JSON.stringify(xhr.response));
    }

    const contentType = getContentTypeHeader(xhr);
    const isTextType = contentType.startsWith("text/");
    const isParsableApplicationType = Array.from(PARSABLE_APPLICATION_CONTENT_TYPES).some((type) =>
      contentType.startsWith(type)
    );
    const isImageType = contentType.startsWith("image/");
    const isOctetStream = contentType === "application/octet-stream";

    if (responseType === "blob") {
      if (isImageType || isOctetStream) {
        return await readBlobAsBase64(xhr.response, isImageType);
      }

      if (isTextType || isParsableApplicationType) {
        return await readBlobAsText(xhr.response);
      }
    }

    if (responseType === "arraybuffer") {
      const arrayBuffer = xhr.response as ArrayBuffer;
      const uint8Array = new Uint8Array(arrayBuffer);

      if (isImageType || isOctetStream) {
        const base64String = dataToBase64(uint8Array);
        const type = isImageType ? ResponseBodyDataType.Image : ResponseBodyDataType.Other;
        return parseResponseBodyData(base64String, true, type);
      }

      if (isTextType || isParsableApplicationType) {
        const textResult = decode(uint8Array);
        return parseResponseBodyData(textResult, false, ResponseBodyDataType.Other);
      }
    }

    // fallback
    return undefined;
  } catch (error) {
    return handleReadResponseError(error);
  }
}

/**
 * Convert a short XHR responseType value to a MIME type string.
 *
 * @returns A best-effort MIME type string, or `undefined` when unknown.
 */
function mimeTypeFromResponseType(responseType: string): string | undefined {
  switch (responseType) {
    case "arraybuffer":
    case "blob":
    case "base64":
      return "application/octet-stream";
    case "text":
    case "":
      return "text/plain";
    case "json":
      return "application/json";
    case "document":
      return "text/html";
  }
  return undefined;
}

function shouldDecodeAsText(contentType: string | undefined) {
  if (!contentType) {
    return false;
  }

  if (contentType.startsWith("text/")) {
    return true;
  }

  const mimeType = contentType.split(";")[0].trim().toLowerCase();
  return PARSABLE_APPLICATION_CONTENT_TYPES.has(mimeType);
}

function reconstructTypedArray(serializedData: SerializedTypedArray): Uint8Array {
  const length = Object.keys(serializedData).length;
  const uint8Array = new Uint8Array(length);
  Object.keys(serializedData).forEach((key) => {
    const numKey = parseInt(key);
    uint8Array[numKey] = serializedData[numKey];
  });
  return uint8Array;
}

function dataToBase64(array: SerializedTypedArray) {
  // cannot be done as one-liner such as String.fromCharCode.apply(null, Array.from(array))
  // because of Hermes' "Maximum call stack size exceeded" for large arrays
  const result = [];
  for (let char of array) {
    result.push(String.fromCharCode(char));
  }
  return btoa(result.join(""));
}

function decode(array: Uint8Array) {
  return new TextDecoder().decode(array);
}

/**
 * Deserialize request/response payloads that may be raw binary ({@link Uint8Array}),
 * serialized typed arrays (objects with numeric keys), plain strings, null (if no data
 * was sent in the request body). We also guard against general objects, which may not be parsable.
 *
 * @param data The incoming request/response data to deserialize.
 * @param contentType The MIME content type that guides decoding decisions.
 * @returns Either a decoded string, base64 string, or the original data.
 */
function deserializeRequestData(data: RequestData, contentType: string | undefined) {
  if (!data) {
    return data;
  }

  // Handle React Native FormData with _parts structure
  if (isFormDataObject(data)) {
    try {
      const obj: Record<string, unknown> = {};
      data._parts.forEach(([key, value]) => {
        obj[key] = value;
      });
      return JSON.stringify(obj, null, 2);
    } catch {
      return "[FormData]";
    }
  }

  // Handle native typed Uint8Arrays
  if (data instanceof Uint8Array) {
    return shouldDecodeAsText(contentType) ? decode(data) : dataToBase64(data);
  }

  // Handle objects with numeric keys, which lost information about their type
  if (isSerializedTypedArray(data)) {
    const uint8Array = reconstructTypedArray(data);
    return shouldDecodeAsText(contentType) ? decode(uint8Array) : dataToBase64(uint8Array);
  }

  // String or other types
  return data;
}

function getContentTypeHeader(xhr: XMLHttpRequest): string {
  const hiddenPropertyHeadersValue =
    // @ts-ignore - RN-specific property
    xhr._headers?.[ContentTypeHeader.LowerCase] || xhr._headers?.[ContentTypeHeader.Default] || "";

  if (xhr.getResponseHeader) {
    return xhr.getResponseHeader(ContentTypeHeader.Default) || hiddenPropertyHeadersValue;
  }
  return hiddenPropertyHeadersValue;
}

module.exports = {
  readResponseText,
  deserializeRequestData,
  mimeTypeFromResponseType,
  getContentTypeHeader,
};
