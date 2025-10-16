const RNInternals = require("../rn-internals/rn-internals");
const { PluginMessageBridge } = require("../plugins/PluginMessageBridge");
const { AsyncBoundedResponseBuffer } = require("./AsyncBoundedResponseBuffer");
const {
  deserializeRequestData,
  mimeTypeFromResponseType,
  readResponseText,
  ContentTypeHeader,
} = require("./networkRequestParsers");

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
  const responseBuffer = new AsyncBoundedResponseBuffer();

  const requestIdPrefix = Math.random().toString(36).slice(2);
  let requestIdCounter = 0;

  function sendCDPMessage(method, params) {
    networkProxy.sendMessage("cdp-message", JSON.stringify({ method, params }));
  }

  async function sendResponseBody(responsePromise, message) {
    const responseBodyData = responsePromise ? await responsePromise : undefined;
    const responseObject = {
      messageId: message.messageId,
      result: responseBodyData,
    };
    networkProxy.sendMessage("cdp-message", JSON.stringify(responseObject));
  }

  function listener(message) {
    try {
      if (message.method === "Network.disable") {
        networkProxy.removeMessageListener("cdp-message", listener);
      } else if (
        message.method === "Network.getResponseBody" &&
        message.params.requestId.startsWith(requestIdPrefix)
      ) {
        const requestId = message.params.requestId;
        const responsePromise = responseBuffer.get(requestId);

        // Upon initial launch, the message gets send twice in dev, because of
        // react Strict Mode and dependency on useEffect. To be fixed in next PR's.
        sendResponseBody(responsePromise, message);
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

      sendCDPMessage("Network.requestWillBeSent", {
        requestId: requestId,
        loaderId,
        timestamp: sendTime / 1000,
        wallTime: Math.floor(Date.now() / 1000),
        request: {
          url: xhr._url,
          method: xhr._method,
          headers: xhr._headers,
          postData: deserializeRequestData(
            data,
            xhr._headers[ContentTypeHeader.ANDROID] || xhr._headers[ContentTypeHeader.IOS]
          ),
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
        xhr._aborted = true;
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
        xhr._error = true;
      });

      xhr.addEventListener("readystatechange", (event) => {
        try {
          if (xhr.readyState === HEADERS_RECEIVED) {
            ttfb = Date.now() - sendTime;
          }
        } catch (error) {}
      });

      xhr.addEventListener("load", (event) => {
        if (xhr._error || xhr._aborted) {
          return;
        }

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
        if (xhr._error || xhr._aborted) {
          return;
        }
        // We only store the xhr response body object, so we only put on
        // the buffer when loading ends, to get the actual loaded response
        const responsePromise = readResponseText(xhr);
        responseBuffer.put(requestId, responsePromise);

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
