const RNInternals = require("./rn-internals/rn-internals");
const { PluginMessageBridge } = require("./plugins/PluginMessageBridge");
const TextDecoder = require("./polyfills").TextDecoder;
const { BoundedResponseBuffer } = require("./BoundedXhrBuffer");

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
]);

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

function deserializeRequestData(data, contentType) {
  const shouldDecodeAsText = (dataContentType) => {
    if (!dataContentType) {
      return false;
    }

    if (dataContentType.startsWith("text/")) {
      return true;
    }

    const mimeType = dataContentType.split(";")[0].trim().toLowerCase();
    return PARSABLE_APPLICATION_CONTENT_TYPES.has(mimeType);
  };

  const isSerializedTypedArray = (obj) => {
    return (
      obj &&
      typeof obj === "object" &&
      !Array.isArray(obj) &&
      typeof obj.length === "number" &&
      Object.keys(obj).every((key) => !isNaN(parseInt(key)))
    );
  };

  const dataToBase64 = (array) => {
    return btoa(String.fromCharCode.apply(null, Array.from(array)));
  };
  const decode = (array) => {
    return new TextDecoder().decode(array);
  };

  const reconstructTypedArray = (serializedData) => {
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

let setupCompleted = false;

export function setup() {
  if (setupCompleted) {
    return;
  }
  setupCompleted = true;

  const messageBridge = new PluginMessageBridge("network");

  let enabled = false;
  messageBridge.addMessageListener("cdp-message", (message) => {
    try {
      if (message.method === "Network.enable" && !enabled) {
        enabled = true;
        enableNetworkInspect(messageBridge);
      } else if (message.method === "Network.disable" && enabled) {
        enabled = false;
        disableNetworkInspect();
      }
    } catch (error) {}
  });
}

function disableNetworkInspect() {
  RNInternals.XHRInterceptor.disableInterception();
}

function enableNetworkInspect(networkProxy) {
  const XHRInterceptor = RNInternals.XHRInterceptor;

  const loaderId = "xhr-interceptor";
  const responseBuffer = new BoundedResponseBuffer(PARSABLE_APPLICATION_CONTENT_TYPES);

  const requestIdPrefix = Math.random().toString(36).slice(2);
  let requestIdCounter = 0;

  function listener(message) {
    try {
      if (message.method === "Network.disable") {
        networkProxy.removeMessageListener("cdp-message", listener);
      } else if (
        message.method === "Network.getResponseBody" &&
        message.params.requestId.startsWith(requestIdPrefix)
      ) {
        //TODO The request gets send twice, check why
        const requestId = message.params.requestId;

        const responsePromise = responseBuffer.get(requestId);

        responsePromise
          ?.then((responseBodyInfo) => {
            networkProxy.sendMessage(
              "cdp-message",
              JSON.stringify({
                id: message.id,
                result: responseBodyInfo,
              })
            );
          })
          .catch(() => {});
      }
    } catch (error) {}
  }
  networkProxy.addMessageListener("cdp-message", listener);

  const HEADERS_RECEIVED = 2; // readyState value when headers are received

  function sendCallback(data, xhr) {
    try {
      const requestId = `${requestIdPrefix}-${requestIdCounter++}`;
      const sendTime = Date.now();
      let ttfb;

      function sendCDPMessage(method, params) {
        networkProxy.sendMessage("cdp-message", JSON.stringify({ method, params }));
      }

      sendCDPMessage("Network.requestWillBeSent", {
        requestId: requestId,
        loaderId,
        timestamp: sendTime / 1000,
        wallTime: Math.floor(Date.now() / 1000),
        request: {
          url: xhr._url,
          method: xhr._method,
          headers: xhr._headers,
          postData: deserializeRequestData(data, xhr._headers["content-type"]),
        },
        type: "XHR",
        initiator: {
          type: "script",
        },
      });

      xhr.addEventListener("abort", (event) => {
        try {
          sendCDPMessage("Network.loadingFailed", {
            requestId: requestId,
            timestamp: Date.now() / 1000,
            type: "XHR",
            errorText: "Aborted",
            canceled: true,
          });
        } catch (error) {}
      });

      xhr.addEventListener("error", (event) => {
        try {
          sendCDPMessage("Network.loadingFailed", {
            requestId: requestId,
            timestamp: Date.now() / 1000,
            type: "XHR",
            errorText: "Failed",
            cancelled: false,
          });
        } catch (error) {}
      });

      xhr.addEventListener("readystatechange", (event) => {
        try {
          if (xhr.readyState === HEADERS_RECEIVED) {
            ttfb = Date.now() - sendTime;
          }
        } catch (error) {}
      });

      xhr.addEventListener("load", (event) => {
        try {
          const mimeType = mimeTypeFromResponseType(xhr.responseType);
          sendCDPMessage("Network.responseReceived", {
            requestId: requestId,
            loaderId,
            timestamp: Date.now() / 1000,
            ttfb,
            type: "XHR",
            response: {
              type: xhr.responseType,
              url: xhr._url,
              status: xhr.status,
              statusText: xhr.statusText,
              headers: xhr.responseHeaders,
              mimeType: mimeType,
              data: deserializeRequestData(data, mimeType),
            },
          });
        } catch (error) {}
      });

      xhr.addEventListener("loadend", (event) => {
        // We store the xhr object only to be able to read response body later
        // if the request is not loaded, there is no point storing it, as it
        // won't have any response data
        responseBuffer.put(requestId, xhr);

        try {
          sendCDPMessage("Network.loadingFinished", {
            requestId: requestId,
            timestamp: Date.now() / 1000,
            duration: Date.now() - sendTime,
            encodedDataLength: xhr._response.size || xhr._response.length, // when response is blob, we use size, and length otherwise
          });
        } catch (error) {}
      });
    } catch (error) {}
  }

  XHRInterceptor.disableInterception();
  XHRInterceptor.setSendCallback(sendCallback);
  XHRInterceptor.enableInterception();
}
