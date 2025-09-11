import { NetworkLog } from "../hooks/useNetworkTracker";

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

export function formatRequestBody(body: unknown): string {
  if (typeof body !== "string") {
    return "No response body";
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

export function getRequestDetails(log: NetworkLog): string {
  const request = log.request;

  if (!request) {
    return prettyStringify({ error: "No request data" });
  }

  const { postData, method, url, headers = {} } = request;

  const requestData: Record<string, unknown> = {
    method,
    url,
    headers,
  };

  if (postData) {
    requestData.body = formatRequestBody(postData);
  }

  return prettyStringify(requestData);
}

export function getResponseDetails(log: NetworkLog): string {
  const response = log.response;
  if (!response) {
    return prettyStringify({ error: "No response data" });
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

export function getRequestPayload(log: NetworkLog): string {
  const request = log.request;
  if (!request) {
    return "No request payload";
  }

  const { url, postData } = request;

  const urlParams = formatUrlParams(url);
  const _hasUrlParams = hasUrlParams(log);

  if (postData && postData !== "") {
    const bodyData = formatRequestBody(postData);

    if (_hasUrlParams) {
      return `URL Parameters:\n${urlParams}\n\nRequest Body:\n${bodyData}`;
    }
    return bodyData;
  }

  if (_hasUrlParams) {
    return urlParams;
  }

  return "No request payload";
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
