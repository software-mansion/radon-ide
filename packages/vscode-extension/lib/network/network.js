const RNInternals = require("../rn-internals/rn-internals");
const { PluginMessageBridge } = require("../plugins/PluginMessageBridge");
const { AsyncBoundedResponseBuffer } = require("./AsyncBoundedResponseBuffer");

const fetchInterceptor = require("./interceptors/PolyfillFetchInterceptor");

const {
  deserializeRequestData,
  mimeTypeFromResponseType,
  getXHRResponseDataPromise,
  getContentTypeHeader,
} = require("./networkRequestParsers");

let setupCompleted = false;

export function setup() {
  if (setupCompleted) {
    return;
  }
  setupCompleted = true;

  const messageBridge = new PluginMessageBridge("network");
  const responseBuffer = new AsyncBoundedResponseBuffer();

  // Clear any stored messages on the extension end on setup
  messageBridge.sendMessage("ide-message", JSON.stringify({ method: "IDE.clearStoredMessages", params: {} }));

  let enabled = false;
  messageBridge.addMessageListener("cdp-message", (message) => {
    try {
      if (message.method === "Network.enable" && !enabled) {
        enabled = true;
        enableNetworkInspect(messageBridge, responseBuffer);
      } else if (message.method === "Network.disable" && enabled) {
        enabled = false;
        disableNetworkInspect(responseBuffer);
      }
    } catch (error) {}
  });
}

function disableNetworkInspect(responseBuffer) {
  RNInternals.XHRInterceptor.disableInterception();
  fetchInterceptor.disableInterception();
  responseBuffer.clear();
}

function enableNetworkInspect(networkProxy, responseBuffer) {
  const XHRInterceptor = RNInternals.XHRInterceptor;
  fetchInterceptor.enableInterception(networkProxy, responseBuffer);

  const loaderId = "xhr-interceptor";

  const requestIdPrefix = "XHR";
  let requestIdCounter = 0;

  function sendCDPMessage(method, params) {
    networkProxy.sendMessage("cdp-message", JSON.stringify({ method, params }));
  }

  async function sendResponseBody(responsePromise, message) {
    const responseBodyData = responsePromise ? await responsePromise : undefined;
    const responseObject = {
      method: "IDE.ResponseBodyData",
      messageId: message.messageId,
      params: { requestId: message.params.requestId },
      result: responseBodyData,
    };
    networkProxy.sendMessage("ide-message", JSON.stringify(responseObject));
  }

  function cdpListener(message) {
    try {
      switch (message.method) {
        case "Network.disable":
          networkProxy.removeMessageListener("cdp-message", cdpListener);
          networkProxy.removeMessageListener("ide-message", ideListener);
          break;
        case "Network.getResponseBody":
          const requestId = `${message.params.requestId}`;
          const responsePromise = responseBuffer.get(requestId);

          // Upon initial launch, the message gets send twice in dev, because of
          // react Strict Mode and dependency on useEffect. To be fixed in next PR's.
          sendResponseBody(responsePromise, message);
          break;
        default:
          break;
      }
    } catch (error) {}
  }

  function ideListener(message) {
    try {
      switch (message.method) {
        case "IDE.stopNetworkTracking":
          responseBuffer.disableBuffering();
          break;
        case "IDE.startNetworkTracking":
          responseBuffer.enableBuffering();
          break;
      }
    } catch (error) {}
  }

  networkProxy.addMessageListener("cdp-message", cdpListener);
  networkProxy.addMessageListener("ide-message", ideListener);

  const HEADERS_RECEIVED = 2; // readyState value when headers are received

  function sendCallback(data, xhr) {
    try {
      const requestId = `${requestIdPrefix}-${requestIdCounter++}`;
      const sendTime = Date.now();
      let ttfb;

      sendCDPMessage("Network.requestWillBeSent", {
        requestId: requestId,
        loaderId,
        timestamp: sendTime,
        wallTime: Date.now(),
        request: {
          url: xhr._url,
          method: xhr._method,
          headers: xhr._headers,
          postData: deserializeRequestData(data, getContentTypeHeader(xhr)),
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
            timestamp: Date.now(),
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
            timestamp: Date.now(),
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
            timestamp: Date.now(),
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
        const responsePromise = getXHRResponseDataPromise(xhr);
        responseBuffer.put(requestId, responsePromise);

        try {
          sendCDPMessage("Network.loadingFinished", {
            requestId: requestId,
            timestamp: Date.now(),
            duration: Date.now() - sendTime,
            encodedDataLength: xhr._response?.size || xhr._response?.length, // when response is blob, we use size, and length otherwise
          });
        } catch (error) {}
      });
    } catch (error) {}
  }

  XHRInterceptor.disableInterception();
  XHRInterceptor.setSendCallback(sendCallback);
  XHRInterceptor.enableInterception();
}
