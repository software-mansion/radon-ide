import { NetworkLog } from "../hooks/useNetworkTracker";

function stringify(obj: unknown): string {
  return JSON.stringify(obj, null, 2);
}

export function formatUrlParams(url: string): string {
  try {
    const urlObj = new URL(url);
    const params: Record<string, string> = {};
    urlObj.searchParams.forEach((value, key) => {
      params[key] = value;
    });
    return stringify(params);
  } catch {
    return stringify({});
  }
}

export function formatJSONBody(body: unknown): string {
  if (typeof body !== "string") {
    return "No response body";
  }
  try {
    const parsed = JSON.parse(body);
    return stringify(parsed);
  } catch {
    return body;
  }
}

export function getRequestJson(log: NetworkLog): string {
  if (!log.request) {
    return JSON.stringify({ error: "No request data" }, null, 2);
  }

  const requestData: Record<string, unknown> = {
    method: log.request.method,
    url: log.request.url,
    headers: log.request.headers || {},
  };

  if (log.request.postData) {
    try {
      requestData.body = JSON.parse(log.request.postData);
    } catch {
      requestData.body = log.request.postData;
    }
  }

  return JSON.stringify(requestData, null, 2);
}

export function getResponseJson(log: NetworkLog): string {
  if (!log.response) {
    return JSON.stringify({ error: "No response data" }, null, 2);
  }

  const responseData: Record<string, unknown> = {
    status: log.response.status,
    statusText: log.response.statusText,
    headers: log.response.headers || {},
  };

  if (log.response.content) {
    responseData.body = log.response.content;
  }

  return JSON.stringify(responseData, null, 2);
}

export function getRequestPayload(log: NetworkLog): string {
  if (!log.request) {
    return "No request payload";
  }

  const { url, postData } = log.request;

  const urlParams = formatUrlParams(url);
  const _hasUrlParams = hasUrlParams(log);

  if (postData && postData !== "") {
    const bodyData = formatJSONBody(postData);

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

export function hasUrlParams(log: NetworkLog | null): boolean {
  if (!log?.request) {
    return false;
  }

  const urlParams = formatUrlParams(log.request.url);
  return urlParams !== "{}";
}
