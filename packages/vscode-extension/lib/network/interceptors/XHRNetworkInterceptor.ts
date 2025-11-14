import { AsyncBoundedResponseBuffer } from "../AsyncBoundedResponseBuffer";
import {
  deserializeRequestData,
  getXHRResponseDataPromise,
  getContentTypeHeader,
} from "../networkRequestParsers";
import type { NetworkProxy, ExtendedXMLHttpRequest, RequestData } from "../types";

const RNInternals = require("../../rn-internals/rn-internals");

const LOADER_ID = "xhr-interceptor";
const HEADERS_RECEIVED = 2;
const REQUEST_ID_PREFIX = "XHR";

interface XHRInterceptor {
  disableInterception: () => void;
  enableInterception: () => void;
  setSendCallback: (callback: (data: unknown, xhr: ExtendedXMLHttpRequest) => void) => void;
}

/**
 * RadonXHRInterceptor is responsible for intercepting XMLHttpRequest calls
 * in React Native and forwarding network events to the Chrome DevTools Protocol (CDP).
 */
class XHRNetworkInterceptor {
  private enabled: boolean = false;

  private responseBuffer?: AsyncBoundedResponseBuffer;
  private networkProxy?: NetworkProxy;
  private readonly XHRInterceptor: XHRInterceptor = RNInternals.XHRInterceptor;

  private requestIdCounter: number = 0;

  private sendCDPMessage(method: string, params: Record<string, unknown>): void {
    if (!this.networkProxy) {
      return;
    }
    this.networkProxy.sendMessage("cdp-message", JSON.stringify({ method, params }));
  }

  // arrow function to preserve 'this' context
  private sendCallback = (data: unknown, xhr: ExtendedXMLHttpRequest): void => {
    try {
      const requestId = `${REQUEST_ID_PREFIX}-${this.requestIdCounter++}`;
      const sendTime = Date.now();
      let ttfb: number | undefined;

      this.sendCDPMessage("Network.requestWillBeSent", {
        requestId: requestId,
        loaderId: LOADER_ID,
        timestamp: sendTime,
        wallTime: Date.now(),
        request: {
          url: xhr._url,
          method: xhr._method,
          headers: xhr._headers,
          postData: deserializeRequestData(data as RequestData, getContentTypeHeader(xhr)),
        },
        initiator: {
          type: "script",
        },
      });

      xhr.addEventListener("abort", (_event) => {
        try {
          this.sendCDPMessage("Network.loadingFailed", {
            requestId: requestId,
            timestamp: Date.now(),
            type: "",
            errorText: "Aborted",
            canceled: true,
          });
        } catch (error) {}
        xhr._aborted = true;
      });

      xhr.addEventListener("error", (_event) => {
        try {
          this.sendCDPMessage("Network.loadingFailed", {
            requestId: requestId,
            timestamp: Date.now(),
            type: "",
            errorText: "Failed",
            cancelled: false,
          });
        } catch (error) {
          // Silently handle error
        }
        xhr._error = true;
      });

      xhr.addEventListener("readystatechange", (_event) => {
        try {
          if (xhr.readyState === HEADERS_RECEIVED) {
            ttfb = Date.now() - sendTime;
          }
        } catch (error) {}
      });

      xhr.addEventListener("load", (_event) => {
        if (xhr._error || xhr._aborted) {
          return;
        }

        try {
          const mimeType = getContentTypeHeader(xhr) || "xhr";
          this.sendCDPMessage("Network.responseReceived", {
            requestId: requestId,
            loaderId: LOADER_ID,
            timestamp: Date.now(),
            ttfb,
            type: mimeType,
            response: {
              type: xhr.responseType,
              url: xhr._url,
              status: xhr.status,
              statusText: xhr.statusText,
              headers: xhr.responseHeaders,
              mimeType: mimeType,
            },
          });
        } catch (error) {}
      });

      xhr.addEventListener("loadend", (_event) => {
        if (xhr._error || xhr._aborted) {
          return;
        }

        // We only store the xhr response body object, so we only put on
        // the buffer when loading ends, to get the actual loaded response
        const responsePromise = getXHRResponseDataPromise(xhr);
        this.responseBuffer?.put(requestId, responsePromise);

        try {
          this.sendCDPMessage("Network.loadingFinished", {
            requestId: requestId,
            timestamp: Date.now(),
            duration: Date.now() - sendTime,
            // @ts-ignore
            encodedDataLength: xhr._response?.size || xhr._response?.length, // when response is blob, we use size, and length otherwise
          });
        } catch (error) {}
      });
    } catch (error) {}
  };

  private setupInterception(): void {
    this.requestIdCounter = 0;

    this.XHRInterceptor.disableInterception();
    this.XHRInterceptor.setSendCallback(this.sendCallback);
    this.XHRInterceptor.enableInterception();
  }

  public enable(networkProxy: NetworkProxy, responseBuffer: AsyncBoundedResponseBuffer): void {
    if (this.enabled) {
      return;
    }

    this.responseBuffer = responseBuffer;
    this.networkProxy = networkProxy;
    this.setupInterception();

    this.enabled = true;
  }

  public disable(): void {
    if (!this.enabled) {
      return;
    }

    this.XHRInterceptor.disableInterception();
    this.responseBuffer = undefined;
    this.networkProxy = undefined;

    this.enabled = false;
  }
}

const XHRNetworkInterceptorInstance = new XHRNetworkInterceptor();

export function enableInterception(
  networkProxy: NetworkProxy,
  responseBuffer: AsyncBoundedResponseBuffer
): void {
  XHRNetworkInterceptorInstance.enable(networkProxy, responseBuffer);
}

export function disableInterception(): void {
  XHRNetworkInterceptorInstance.disable();
}

module.exports = {
  enableInterception,
  disableInterception,
};
