const { PluginMessageBridge } = require("../plugins/PluginMessageBridge");
const { AsyncBoundedResponseBuffer } = require("./AsyncBoundedResponseBuffer");

const fetchInterceptor = require("./interceptors/PolyfillFetchInterceptor");
const XHRInterceptor = require("./interceptors/XHRNetworkInterceptor");

let setupCompleted = false;

export function setup() {
  if (setupCompleted) {
    return;
  }
  setupCompleted = true;

  const messageBridge = new PluginMessageBridge("network");
  const responseBuffer = new AsyncBoundedResponseBuffer();

  // Clear any stored messages on the extension end on setup
  messageBridge.sendMessage(
    "ide-message",
    JSON.stringify({ method: "IDE.clearStoredMessages", params: {} })
  );

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
  XHRInterceptor.disableInterception();
  fetchInterceptor.disableInterception();
  responseBuffer.clear();
}

function enableNetworkInspect(networkProxy, responseBuffer) {
  fetchInterceptor.enableInterception(networkProxy, responseBuffer);
  XHRInterceptor.enableInterception(networkProxy, responseBuffer);

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
}
