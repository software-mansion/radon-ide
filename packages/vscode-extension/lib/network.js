const RNInternals = require("./rn-internals/rn-internals");
const { PluginMessageBridge } = require("./plugins/PluginMessageBridge");
const TextDecoder = require("./polyfills").TextDecoder;
const BoundedXhrBuffer = require("./BoundedXhrBuffer").BoundedXhrBuffer;

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

const MAX_BODY_SIZE = 100 * 1024; // 100 KB
const TRUNCATED_LENGTH = 100;

function truncateResponseBody(responseBody) {
  if (responseBody && new Blob([responseBody]).size > MAX_BODY_SIZE) {
    return {
      body: `${responseBody.slice(0, TRUNCATED_LENGTH)}...`,
      wasTruncated: true,
    };
  }

  return { body: responseBody, wasTruncated: false };
}

function readResponseBodyContent(xhr) {
  if (!xhr && !xhr._cachedResponse) {
    // if response was accessed it is cached and we can use it
    // otherwise we don't want to read it here to avoid potential side effects
    return Promise.resolve(undefined);
  }
  const responseType = xhr.responseType;

  if (responseType === "" || responseType === "text") {
    const truncatedBody = truncateResponseBody(xhr.responseText);
    return Promise.resolve(truncatedBody);
  }

  if (responseType === "blob") {
    const contentType = xhr.getResponseHeader("Content-Type") || "";
    const isTextType = contentType.startsWith("text/");
    const isParsableApplicationType = Array.from(PARSABLE_APPLICATION_CONTENT_TYPES).some((type) =>
      contentType.startsWith(type)
    );

    if (isTextType || isParsableApplicationType) {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => {
          const truncatedBody = truncateResponseBody(reader.result || undefined);
          resolve(truncatedBody);
        };
        reader.readAsText(xhr.response);
      });
    }
  }
  // don't want to read binary data here
  return Promise.resolve(undefined);
}

function deserializeDataContent(data, contentType) {
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
  const xhrBuffer = new BoundedXhrBuffer();

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
        const requestId = message.params.requestId;
        const xhr = xhrBuffer.get(requestId);
        // typically with devtools UI, each request details will be fetched at most once.
        // we can safely delete the record once the request data is retrieved.
        if (xhr) {
          xhrBuffer.remove(requestId);
        }

        readResponseBodyContent(xhr)
          .then((bodyInfo) => {
            networkProxy.sendMessage(
              "cdp-message",
              JSON.stringify({
                id: message.id,
                result: bodyInfo,
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
          postData: deserializeDataContent(data, xhr._headers["content-type"]),
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
              data: deserializeDataContent(data, mimeType),
            },
          });
        } catch (error) {}
      });

      xhr.addEventListener("loadend", (event) => {
        // We store the xhr object only to be able to read response body later
        // if the request is not loaded, there is no point storing it, as it
        // won't have any response data
        xhrBuffer.put(requestId, xhr);

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
