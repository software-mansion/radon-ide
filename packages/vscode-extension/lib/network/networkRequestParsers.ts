import { TextDecoder } from "../polyfills";

export type InternalResponseBodyData = {
  body: string | undefined;
  wasTruncated: boolean;
  dataSize: number;
};

// Allowed content types for processing text-based data
const PARSABLE_APPLICATION_CONTENT_TYPES = new Set([
  "application/x-sh",
  "application/x-csh",
  "application/rtf",
  "application/manifest+json",
  "application/xhtml+xml",
  "application/xml",
  "application/XUL",
  "application/ld+json",
  "application/json",
  "application/javascript",
  "application/x-javascript",
  "application/yaml",
]);

/**
 * Maximum memory size (in bytes) to store buffered text and image request
 * bodies.
 */
const MAX_BODY_SIZE = 1024 * 1024; // 1 MB
const TRUNCATED_LENGTH = 1000; // 1000 characters

/**
 * Truncate and measure a response body for buffering.
 *
 * - If `responseBody` is falsy, returns an object with no body and zero size.
 * - If the serialized size of `responseBody` exceeds `MAX_BODY_SIZE`, the
 *   body is sliced to `TRUNCATED_LENGTH` characters and marked as truncated.
 * - Otherwise returns the original body and its computed byte size.
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
function truncateResponseBody(responseBody: string | undefined): InternalResponseBodyData {
  if (!responseBody) {
    return { body: undefined, wasTruncated: false, dataSize: 0 };
  }

  const dataSize = new Blob([responseBody]).size;

  if (dataSize > MAX_BODY_SIZE) {
    const slicedBody = responseBody.slice(0, TRUNCATED_LENGTH);
    return {
      body: `${slicedBody}...`,
      wasTruncated: true,
      dataSize: new Blob([slicedBody]).size,
    };
  }

  return { body: responseBody, wasTruncated: false, dataSize };
}

/**
 * Parse an `XMLHttpRequest` response into an InternalResponseBodyData.
 *
 * This method is async because reading `blob` response types requires a
 * FileReader. Behavior summary:
 * - If `xhr` is falsy, not cached (`_cachedResponse`) or non-parsable binary type, returns
 *   `undefined` to avoid side effects.
 * - If `responseType` is `""` or `"text"`, reads `xhr.responseText` and
 *   delegates truncation/size-measurement to `truncateResponseBody`.
 * - If `responseType` is `"blob"` and the `Content-Type` indicates a text
 *   or parsable application type reads the blob as text using FileReader (asynchronously) and
 *   then delegates to `truncateResponseBody`.
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
    // @ts-ignore - RN-specific property
    if (!xhr || !xhr._cachedResponse) {
      // if response was not accessed, it's not cached and we don't want to read it
      // here to avoid potential side effects
      return undefined;
    }

    const responseType = xhr.responseType;

    if (responseType === "" || responseType === "text") {
      return truncateResponseBody(xhr.responseText);
    }

    if (responseType === "blob") {
      const contentType = xhr.getResponseHeader("Content-Type") || "";
      const isTextType = contentType.startsWith("text/");
      const isParsableApplicationType = Array.from(PARSABLE_APPLICATION_CONTENT_TYPES).some(
        (type) => contentType.startsWith(type)
      );

      if (isTextType || isParsableApplicationType) {
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result;
            const textResult = typeof result === "string" ? result : undefined;
            resolve(truncateResponseBody(textResult));
          };
          reader.onerror = (error) => {
            console.warn("Failed to read response body content:", error);
            resolve(truncateResponseBody(undefined));
          };
          reader.readAsText(xhr.response);
        });
      }
    }

    // don't read binary data
    return undefined;
  } catch (error) {
    console.warn("Failed to read response body content:", error);
    return undefined;
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

interface SerializedTypedArray {
  length: number;
  [key: number]: number;
}
type RequestData = string | SerializedTypedArray | null | object;

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
  const shouldDecodeAsText = (dataContentType: string | undefined) => {
    if (!dataContentType) {
      return false;
    }

    if (dataContentType.startsWith("text/")) {
      return true;
    }

    const mimeType = dataContentType.split(";")[0].trim().toLowerCase();
    return PARSABLE_APPLICATION_CONTENT_TYPES.has(mimeType);
  };

  const isSerializedTypedArray = (obj: unknown): obj is SerializedTypedArray => {
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
      return false;
    }
    const record = obj as Record<string, unknown>;
    // length may exist but not be a number, so check safely
    if (typeof record.length !== "number") {
      return false;
    }
    return Object.keys(record).every((key) => !isNaN(parseInt(key, 10)));
  };

  const dataToBase64 = (array: SerializedTypedArray) => {
    return btoa(String.fromCharCode.apply(null, Array.from(array)));
  };
  const decode = (array: Uint8Array) => {
    return new TextDecoder().decode(array);
  };

  const reconstructTypedArray = (serializedData: SerializedTypedArray) => {
    const length = Object.keys(serializedData).length;
    const uint8Array = new Uint8Array(length);
    Object.keys(serializedData).forEach((key) => {
      uint8Array[parseInt(key)] = serializedData[key];
    });
    return uint8Array;
  };

  if (!data || !contentType) {
    return data;
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

module.exports = {
  readResponseText,
  deserializeRequestData,
  mimeTypeFromResponseType,
};
