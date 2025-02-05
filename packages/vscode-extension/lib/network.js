function mimeTypeFromResponseType(responseType) {
  switch (responseType) {
    case "arraybuffer":
    case "blob":
    case "base64":
      return "application/octet-stream";
    case "text":
      return "text/plain";
    case "json":
      return "application/json";
    case "document":
      return "text/html";
  }
  return undefined;
}

export function enableNetworkInspect(devtoolsAgent, payload) {
  const XHRInterceptor = require("react-native/Libraries/Network/XHRInterceptor");

  const loaderId = "xhr-interceprot";

  if (!payload.enable) {
    XHRInterceptor.disableInterception();
    return;
  }

  const requestIdPrefix = Math.random().toString(36).slice(2);
  let requestIdCounter = 0;

  function sendCallback(data, xhr) {
    const requestId = `${requestIdPrefix}-${requestIdCounter++}`;
    const sendTime = Date.now();

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
