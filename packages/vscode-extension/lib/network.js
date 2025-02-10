function mimeTypeFromResponseType(responseType) {
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

function readResponseBodyContent(xhr) {
  if (!xhr && !xhr._cachedResponse) {
    // if response was accessed it is cached and we can use it
    // otherwise we don't want to read it here to avoid potential side effects
    return Promise.resolve(undefined);
  }
  const responseType = xhr.responseType;
  if (responseType === "" || responseType === "text") {
    return Promise.resolve(xhr.responseText);
  }
  if (responseType === "blob") {
    const contentType = xhr.getResponseHeader("Content-Type");
    if (contentType.startsWith("text/") || contentType.startsWith("application/json")) {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          resolve(reader.result);
        };
        reader.readAsText(xhr.response);
      });
    }
  }
  // don't want to read binary data here
  return Promise.resolve(undefined);
}

export function enableNetworkInspect(devtoolsAgent, payload) {
  const XHRInterceptor = require("react-native/Libraries/Network/XHRInterceptor");

  const loaderId = "xhr-interceptor";
  const xhrsMap = new Map();

  if (!payload.enable) {
    XHRInterceptor.disableInterception();
    return;
  }

  const requestIdPrefix = Math.random().toString(36).slice(2);
  let requestIdCounter = 0;

  devtoolsAgent._bridge.addListener("RNIDE_networkInspectorCDPRequest", (message) => {
    if (
      message.method === "Network.getResponseBody" &&
      message.params.requestId.startsWith(requestIdPrefix)
    ) {
      const requestId = message.params.requestId;
      const xhr = xhrsMap.get(requestId)?.deref();
      readResponseBodyContent(xhr).then((body) => {
        devtoolsAgent._bridge.send(
          "RNIDE_networkInspectorCDPMessage",
          JSON.stringify({
            id: message.id,
            result: { body },
          })
        );
      });
    }
  });

  function sendCallback(data, xhr) {
    const requestId = `${requestIdPrefix}-${requestIdCounter++}`;
    const sendTime = Date.now();

    xhrsMap.set(requestId, new WeakRef(xhr));

    function sendCDPMessage(method, params) {
      devtoolsAgent._bridge.send(
        "RNIDE_networkInspectorCDPMessage",
        JSON.stringify({ method, params })
      );
    }

    sendCDPMessage("Network.requestWillBeSent", {
      requestId: requestId,
      loaderId,
      documentURL: "http://ide.swmansion.com",
      timestamp: sendTime / 1000,
      wallTime: Math.floor(Date.now() / 1000),
      request: {
        url: xhr._url,
        method: xhr._method,
        headers: xhr._headers,
      },
      type: "XHR",
      initiator: {
        type: "script",
      },
    });

    xhr.addEventListener("abort", (event) => {});

    xhr.addEventListener("error", (event) => {});

    xhr.addEventListener("load", (event) => {
      sendCDPMessage("Network.responseReceived", {
        requestId: requestId,
        loaderId,
        timestamp: Date.now() / 1000,
        type: "XHR",
        response: {
          url: xhr._url,
          status: xhr.status,
          statusText: xhr.statusText,
          headers: xhr.responseHeaders,
          mimeType: mimeTypeFromResponseType(xhr.responseType),
        },
      });
    });

    xhr.addEventListener("loadend", (event) => {
      sendCDPMessage("Network.loadingFinished", {
        requestId: requestId,
        timestamp: Date.now() / 1000,
        encodedDataLength: xhr._response.length,
      });
    });
  }

  XHRInterceptor.disableInterception();
  XHRInterceptor.setSendCallback(sendCallback);
  XHRInterceptor.enableInterception();
}
