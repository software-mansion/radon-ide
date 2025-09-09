function stringify(obj: unknown): string {
  return JSON.stringify(obj, null, 2);
}

export function formatJSONBody(body: unknown): string | undefined {
  if (typeof body !== "string") {
    return undefined;
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
