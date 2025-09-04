import { NetworkLog } from "../hooks/useNetworkTracker";

export function generateCurlCommand(log: NetworkLog): string {
  if (!log.request) {
    return "# No request data available";
  }

  const { method = "GET", url, headers = {}, postData } = log.request;

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

export function generateFetchCommand(log: NetworkLog): string {
  if (!log.request) {
    return "// No request data available";
  }

  const { method = "GET", url, headers = {}, postData } = log.request;

  let fetchCode = `fetch("${url}", {\n  method: "${method.toUpperCase()}"`;

  // headers
  if (Object.keys(headers).length > 0) {
    fetchCode += `,\n  headers: ${JSON.stringify(headers, null, 4).replace(/^/gm, "  ")}`;
  }

  // body for requests
  if (postData !== null && postData !== undefined) {
    try {
      // try to format as JSON if it's valid
      const parsedData = JSON.parse(postData);
      fetchCode += `,\n  body: JSON.stringify(${JSON.stringify(parsedData, null, 4).replace(/^/gm, "  ")})`;
    } catch {
      // use as string literal
      fetchCode += `,\n  body: ${JSON.stringify(postData)}`;
    }
  }

  fetchCode += `\n})\n.then(response => response.json())\n.then(data => console.log(data))\n.catch(error => console.error('Error:', error));`;

  return fetchCode;
}

export function getUrl(log: NetworkLog): string {
  return log.request?.url || "No URL available";
}