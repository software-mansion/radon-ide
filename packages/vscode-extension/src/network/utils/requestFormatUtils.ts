import { NetworkLog } from "../hooks/useNetworkTracker";

function stringify(obj: unknown): string {
  return JSON.stringify(obj, null, 2);
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

/**
 * Formats response body for copying
 */
export function formatResponseBodyForCopy(body: unknown): string {
  if (!body) {
    return "No response body available";
  }
  
  if (typeof body === "string") {
    try {
      // Try to parse and re-stringify for pretty formatting
      const parsed = JSON.parse(body);
      return JSON.stringify(parsed, null, 2);
    } catch {
      // Return as-is if not valid JSON
      return body;
    }
  }
  
  // For non-string bodies, stringify them
  return JSON.stringify(body, null, 2);
}

/**
 * Extracts and formats request data as JSON for copying
 */
export function getRequestJson(log: NetworkLog): string {
  if (!log.request) {
    return JSON.stringify({ error: "No request data available" }, null, 2);
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

/**
 * Extracts and formats response data as JSON for copying
 */
export function getResponseJson(log: NetworkLog): string {
  if (!log.response) {
    return JSON.stringify({ error: "No response data available" }, null, 2);
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
