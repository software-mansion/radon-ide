import { ContentTypeHeader, ResponseBodyDataType, ResponseData } from "../types/network";
import { NetworkLog } from "../types/networkLog";

function prettyStringify(obj: unknown): string {
  return JSON.stringify(obj, null, 2);
}

function codeIndentStringify(data: unknown): string {
  const INDENT = "    ";
  return JSON.stringify(data, null, 4).replace(/^/gm, INDENT);
}

export function hasUrlParams(log: NetworkLog | null): boolean {
  const request = log?.request;
  if (!request) {
    return false;
  }

  const urlObj = new URL(request.url);
  return urlObj.searchParams.size > 0;
}

function formatUrlParams(url: string): string {
  try {
    const urlObj = new URL(url);
    const params: Record<string, string> = {};
    urlObj.searchParams.forEach((value, key) => {
      params[key] = value;
    });
    return prettyStringify(params);
  } catch {
    return prettyStringify({});
  }
}

export function getFormattedRequestBody(body: unknown): string | undefined {
  if (typeof body !== "string") {
    return undefined;
  }
  try {
    const parsed = JSON.parse(body);
    return prettyStringify(parsed);
  } catch {
    return body;
  }
}

export function getUrl(log: NetworkLog): string {
  return log.request?.url || "No URL available";
}

export function getRequestDetails(log: NetworkLog): string | undefined {
  const request = log.request;

  if (!request) {
    return undefined;
  }

  const { postData, method, url, headers = {} } = request;

  const requestData: Record<string, unknown> = {
    method,
    url,
    headers,
  };

  const requestBody = getFormattedRequestBody(postData);
  if (requestBody) {
    requestData.body = requestBody;
  }

  return prettyStringify(requestData);
}

export function getResponseDetails(log: NetworkLog): string | undefined {
  const response = log.response;
  if (!response) {
    return undefined;
  }

  const { status, statusText, headers = {}, content } = response;

  const responseData: Record<string, unknown> = {
    status,
    statusText,
    headers,
  };

  if (content) {
    responseData.body = content;
  }

  return prettyStringify(responseData);
}

export function getRequestPayload(log: NetworkLog): string | undefined {
  const request = log.request;
  if (!request) {
    return undefined;
  }

  const { url, postData } = request;

  const _hasUrlParams = hasUrlParams(log);
  const urlParams = formatUrlParams(url);
  const bodyData = getFormattedRequestBody(postData);

  if (bodyData) {
    if (_hasUrlParams) {
      return `URL Parameters:\n${urlParams}\n\nRequest Body:\n${bodyData}`;
    }
    return bodyData;
  }

  if (_hasUrlParams) {
    return urlParams;
  }

  return undefined;
}

export function createCurlCommand(log: NetworkLog): string {
  const request = log.request;
  if (!request) {
    return "# No request data available";
  }

  const { postData, method = "GET", url, headers = {} } = request;

  let curlCommand = `curl -X ${method.toUpperCase()}`;

  // headers
  Object.entries(headers).forEach(([key, value]) => {
    // skip headers that curl adds automatically or that might cause issues
    const skipHeaders = ["host", "content-length", "connection", "user-agent", "accept-encoding"];
    if (!skipHeaders.includes(key.toLowerCase())) {
      curlCommand += ` \\\n  -H "${key}: ${value}"`;
    }
  });

  // request body
  if (postData !== null && postData !== undefined) {
    try {
      // Try to format as JSON if it's valid
      const parsedData = JSON.parse(postData);
      curlCommand += ` \\\n  -d '${JSON.stringify(parsedData)}'`;
    } catch {
      // use as-is but escape single quotes
      const escapedData = postData.replace(/'/g, "'\"'\"'");
      curlCommand += ` \\\n  -d '${escapedData}'`;
    }
  }

  curlCommand += ` \\\n  "${url}"`;

  return curlCommand;
}

export function createFetchCommand(log: NetworkLog): string {
  const FETCH_RESPONSE_HANDLER_CODE = `\n})\n.then(response => response.json())\n.then(data => console.log(data))\n.catch(error => console.error('Error:', error));`;
  const request = log.request;
  if (!request) {
    return "// No request data available";
  }

  const { postData, method = "GET", url, headers = {} } = request;

  let fetchCode = `fetch("${url}", {\n  method: "${method.toUpperCase()}"`;

  // headers
  if (Object.keys(headers).length > 0) {
    fetchCode += `,\n  headers: ${codeIndentStringify(headers)}`;
  }

  // body for requests
  if (postData !== null && postData !== undefined) {
    try {
      // try to format as JSON if it's valid
      const parsedData = JSON.parse(postData);
      fetchCode += `,\n  body: JSON.stringify(${codeIndentStringify(parsedData)})`;
    } catch {
      // use as string literal
      fetchCode += `,\n  body: ${JSON.stringify(postData)}`;
    }
  }

  fetchCode += FETCH_RESPONSE_HANDLER_CODE;

  return fetchCode;
}

/**
 * Supported language resolving based on react-native-devtools-frontend implementation
 * https://github.com/facebook/react-native-devtools-frontend/blob/main/front_end/ui/components/code_highlighter/CodeHighlighter.ts
 */
const LANGUAGE_BY_CONTENT_TYPE = {
  // JSON
  "application/json": "json",
  "application/manifest+json": "json",
  "application/ld+json": "json",
  "text/json": "json",

  // JavaScript and variants
  "text/javascript": "javascript",
  "application/javascript": "javascript",
  "application/ecmascript": "javascript",
  "application/x-ecmascript": "javascript",
  "application/x-javascript": "javascript",
  "text/ecmascript": "javascript",
  "text/javascript1.0": "javascript",
  "text/javascript1.1": "javascript",
  "text/javascript1.2": "javascript",
  "text/javascript1.3": "javascript",
  "text/javascript1.4": "javascript",
  "text/javascript1.5": "javascript",
  "text/jscript": "javascript",
  "text/livescript": "javascript",
  "text/x-ecmascript": "javascript",
  "text/x-javascript": "javascript",

  // JSX
  "text/jsx": "jsx",

  // TypeScript
  "text/typescript": "typescript",
  "text/typescript-jsx": "tsx",

  // HTML
  "text/html": "html",
  "application/xhtml+xml": "html",

  // XML and SVG
  "text/xml": "xml",
  "application/xml": "xml",
  "image/svg+xml": "xml",
  "application/xul": "xml",

  // CSS and variants
  "text/css": "css",
  "text/x-less": "less",
  "text/x-sass": "sass",
  "text/x-scss": "scss",

  // Programming languages
  "text/x-python": "python",
  "text/x-java": "java",
  "text/x-kotlin": "kotlin",
  "text/x-c++src": "cpp",
  "text/x-go": "go",
  "application/x-httpd-php": "php",
  "text/x-sh": "shellscript",
  "application/x-sh": "shellscript",
  "text/x-coffeescript": "coffee",
  "text/x-clojure": "clojure",
  "application/vnd.dart": "dart",
  "text/x-scala": "scala",
  "text/x.angular": "angular-html",
  "text/x.svelte": "svelte",
  "text/x.vue": "vue",

  // Other formats
  "text/markdown": "markdown",
  "application/wasm": "wasm",
  "text/plain": "plaintext",
  "application/yaml": "yaml",
  "text/yaml": "yaml",
};

/**
 * Image and graphics MIME types that can be displayed in a preview
 */
const PREVIEWABLE_IMAGE_TYPES = [
  // image
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/bmp",
  "image/tiff",
  "image/x-icon",
  "image/vnd.microsoft.icon",
  "image/avif",
  "image/apng",

  // SVG
  "image/svg+xml",
];

/**
 * Checks if the content type represents a previewable image format
 */
export function canPreviewImage(
  networkLogContentType: string,
  responseBodyType: ResponseBodyDataType
): boolean {
  if (!networkLogContentType) {
    return false;
  }

  const contentTypeLowerCase = networkLogContentType.toLowerCase();
  const isImageResponseType = responseBodyType === ResponseBodyDataType.Image;
  const isContentTypePreviewable = PREVIEWABLE_IMAGE_TYPES.some((imageType) =>
    contentTypeLowerCase.includes(imageType)
  );

  return isContentTypePreviewable && isImageResponseType;
}

export function determineLanguage(contentType: string, body: string): string {
  const contentTypeLowerCase = contentType.toLowerCase();

  for (const [contentTypeKey, language] of Object.entries(LANGUAGE_BY_CONTENT_TYPE)) {
    if (contentTypeLowerCase.includes(contentTypeKey)) {
      return language;
    }
  }

  // Fallback: try to guess based on content structure
  const trimmedBody = body.trim();
  if (trimmedBody.startsWith("<?xml") || trimmedBody.startsWith("<")) {
    return trimmedBody.includes("<!DOCTYPE html") || trimmedBody.includes("<html") ? "html" : "xml";
  }
  if (trimmedBody.startsWith("{") || trimmedBody.startsWith("[")) {
    return "json";
  }

  return "plaintext";
}

export function getNetworkResponseContentType(
  response: ResponseData | Response | undefined
): string {
  const headers = (response?.headers || {}) as Record<string, string>;
  return headers[ContentTypeHeader.Default] || headers[ContentTypeHeader.LowerCase] || "";
}
