// @ts-ignore
import Fetch from "react-native-fetch-api/src/Fetch";
import { AsyncBoundedResponseBuffer } from "./AsyncBoundedResponseBuffer";
import { BlobLikeResponse, getFetchResponseDataPromise } from "./networkRequestParsers";

const { Networking } = require("react-native");

const LOADER_ID = "fetch-interceptor";

type DidCreateRequestFn = (requestId: number) => void;
type DidReceiveNetworkResponseFn = (
  requestId: number,
  status: number,
  headers: Record<string, string>,
  url: string
) => void;
type DidReceiveNetworkIncrementalDataFn = (
  requestId: number,
  responseText: string,
  progress: number,
  total: number
) => void;
type DidReceiveNetworkDataFn = (requestId: number, response: BlobLikeResponse) => void;
type DidCompleteNetworkResponseFn = (
  requestId: number,
  errorMessage: string,
  didTimeOut: boolean
) => void;

class FetchInterceptor {
  private _enabled: boolean = false;

  private _networkProxy = null;
  private _responseBuffer: AsyncBoundedResponseBuffer | null = null;

  // timing
  private _startTime: number = 0;
  private _ttfbTime = 0;

  private _original__didCreateRequest: DidCreateRequestFn = () => {};
  private _original__didReceiveNetworkResponse: DidReceiveNetworkResponseFn = () => {};
  private _original__didReceiveNetworkIncrementalData: DidReceiveNetworkIncrementalDataFn =
    () => {};
  private _original__didReceiveNetworkData: DidReceiveNetworkDataFn = () => {};
  private _original__didCompleteNetworkResponse: DidCompleteNetworkResponseFn = () => {};
  private _original__abort: () => void = () => {};

  private checkCompatibility() {
    if (!Fetch || !Networking) {
      return false;
    }
    return true;
  }

  private _setupInterceptors() {
    this._handleDidCreateRequest();
    this._handleDidReceiveNetworkResponse();
    this._handleDidReceiveNetworkIncrementalData();
    this._handleDidReceiveNetworkData();
    this._handleDidCompleteNetworkResponse();
    this._handleAbort();
  }

  private _cleanupInterceptors() {
    Fetch.prototype.__didCreateRequest = this._original__didCreateRequest;
    Fetch.prototype.__didReceiveNetworkResponse = this._original__didReceiveNetworkResponse;
    Fetch.prototype.__didReceiveNetworkIncrementalData =
      this._original__didReceiveNetworkIncrementalData;
    Fetch.prototype.__didReceiveNetworkData = this._original__didReceiveNetworkData;
    Fetch.prototype.__didCompleteNetworkResponse = this._original__didCompleteNetworkResponse;
    Fetch.prototype.__abort = this._original__abort;

    this._original__didCreateRequest = () => {};
    this._original__didReceiveNetworkResponse = () => {};
    this._original__didReceiveNetworkIncrementalData = () => {};
    this._original__didReceiveNetworkData = () => {};
    this._original__didCompleteNetworkResponse = () => {};
    this._original__abort = () => {};
  }

  private _handleDidCreateRequest() {
    // eslint-disable-next-line
    const self = this;
    self._original__didCreateRequest = Fetch.prototype.__didCreateRequest;

    Fetch.prototype.__didCreateRequest = function (requestId: number) {
      self._original__didCreateRequest.call(this, requestId);

      // Use original fetch's `this` context to access request details
      self._startTime = Date.now();
      self._sendCDPMessage("Network.requestWillBeSent", {
        requestId: requestId,
        loaderId: LOADER_ID,
        timestamp: self._startTime,
        wallTime: Date.now(),
        request: {
          url: this._request.url,
          method: this._request.method,
          headers: this._request.headers,
          postData: this._request.body,
        },
        type: this._request.type, // FIX THIS
        initiator: {
          type: "script",
        },
      });
    };
  }

  private _handleDidReceiveNetworkResponse() {
    // eslint-disable-next-line
    const self = this;
    self._original__didReceiveNetworkResponse = Fetch.prototype.__didReceiveNetworkResponse;

    Fetch.prototype.__didReceiveNetworkResponse = function (
      requestId: number,
      status: number,
      headers: Record<string, string>,
      url: string
    ) {
      self._original__didReceiveNetworkResponse?.call(this, requestId, status, headers, url);

      if (requestId !== this._requestId) {
        return;
      }

      self._ttfbTime = Date.now() - self._startTime;
    };
  }

  private _handleDidReceiveNetworkIncrementalData() {
    // eslint-disable-next-line
    const self = this;
    self._original__didReceiveNetworkIncrementalData =
      Fetch.prototype.__didReceiveNetworkIncrementalData;

    Fetch.prototype.__didReceiveNetworkIncrementalData = function (
      requestId: number,
      responseText: string,
      progress: number,
      total: number
    ) {
      if (requestId !== this._requestId) {
        return;
      }

      self._original__didReceiveNetworkIncrementalData.call(
        this,
        requestId,
        responseText,
        progress,
        total
      );

      const timeStamp = Date.now();

      self._sendCDPMessage("Network.dataReceived", {
        requestId: requestId,
        loaderId: LOADER_ID,
        timestamp: timeStamp,
        dataLength: responseText.length,
        ttfb: self._ttfbTime,
        encodedDataLength: total <= 0 ? progress : total,
        type: this._response._body._mimeType,
        response: {
          type: this._response.type,
          status: this._responseStatus,
          url: this._responseUrl,
          headers: this._nativeResponseHeaders,
        },
      });
    };
  }

  private _handleDidReceiveNetworkData() {
    // eslint-disable-next-line
    const self = this;

    this._original__didReceiveNetworkData = Fetch.prototype.__didReceiveNetworkData;
    Fetch.prototype.__didReceiveNetworkData = function (
      requestId: number,
      response: BlobLikeResponse
    ) {
      self._original__didReceiveNetworkData.call(this, requestId, response);
      if (requestId !== this._requestId) {
        return;
      }

      const timeStamp = Date.now();

      self._sendCDPMessage("Network.responseReceived", {
        requestId: requestId,
        loaderId: LOADER_ID,
        timestamp: timeStamp,
        ttfb: self._ttfbTime,
        type: response.type,
        response: {
          type: "basic",
          status: this._responseStatus,
          url: this._responseUrl,
          headers: this._nativeResponseHeaders,
        },
        encodedDataLength: this._nativeResponse?.size || this._nativeResponse?.length,
      });
    };
  }

  private _handleDidCompleteNetworkResponse() {
    // eslint-disable-next-line
    const self = this;
    self._original__didCompleteNetworkResponse = Fetch.prototype.__didCompleteNetworkResponse;

    Fetch.prototype.__didCompleteNetworkResponse = function (
      requestId: number,
      errorMessage: string,
      didTimeOut: boolean
    ) {
      self._original__didCompleteNetworkResponse.call(this, requestId, errorMessage, didTimeOut);

      if (requestId !== this._requestId || !this._response) {
        return;
      }

      const timeStamp = Date.now();

      if (didTimeOut || errorMessage) {
        self._sendCDPMessage("Network.loadingFailed", {
          requestId: requestId,
          timestamp: timeStamp,
          type: "",
          errorText: errorMessage || "Timeout",
          canceled: false,
        });

        return;
      }

      self._responseBuffer?.put(
        requestId.toString(),
        getFetchResponseDataPromise(this._response, this._nativeResponseType)
      );

      self._sendCDPMessage("Network.loadingFinished", {
        requestId: requestId,
        timestamp: timeStamp,
        duration: timeStamp - self._startTime,
        type: this._response._body._mimeType,
        // additionally setting the response here, as here we have complete reponse information
        response: {
          type: this._response.type,
          status: this._responseStatus,
          url: this._responseUrl,
          headers: this._nativeResponseHeaders,
          mimeType: this._response._body._mimeType,
        },
        // Not sending the ecnodedDataLength, as we've done so in didReceiveNetworkData and didReceiveNetworkIncrementalData
      });
    };
  }

  private _handleAbort() {
    // eslint-disable-next-line
    const self = this;
    self._original__abort = Fetch.prototype.__abort;

    Fetch.prototype.__abort = function () {
      self._original__abort.call(this);

      const timeStamp = Date.now();

      self._sendCDPMessage("Network.loadingFailed", {
        requestId: this._requestId,
        timestamp: timeStamp,
        type: "XHR", // FIX THIS
        errorText: "Aborted",
        canceled: true,
      });
    };
  }

  public enable(networkProxy: any, responseBuffer: AsyncBoundedResponseBuffer) {
    if (this._enabled || !this.checkCompatibility()) {
      return;
    }

    this._networkProxy = networkProxy;
    this._responseBuffer = responseBuffer;

    if (!global.fetch) {
      return;
    }

    // Setup interceptors
    this._setupInterceptors();
    this._enabled = true;
  }

  public disable() {
    if (!this._enabled) {
      return;
    }

    // Cleanup interceptors
    this._cleanupInterceptors();

    this._networkProxy = null;
    this._responseBuffer = null;
    this._enabled = false;
  }

  private _sendCDPMessage(method: any, params: any) {
    if (!this._networkProxy) {
      return;
    }
    this._networkProxy.sendMessage("cdp-message", JSON.stringify({ method, params }));
  }

  /**
   * Check if interceptor is enabled
   */
  isEnabled(): boolean {
    return this._enabled;
  }
}

let interceptorInstance: FetchInterceptor | null = new FetchInterceptor();

export function enableFetchInterceptor(
  networkProxy: any,
  responseBuffer: AsyncBoundedResponseBuffer
): void {
  if (!interceptorInstance) {
    interceptorInstance = new FetchInterceptor();
  }

  if (!interceptorInstance.isEnabled()) {
    interceptorInstance.enable(networkProxy, responseBuffer);
  }
}

export function disableFetchInterceptor(): void {
  if (interceptorInstance && interceptorInstance.isEnabled()) {
    interceptorInstance.disable();
  }
}

module.exports = { enableFetchInterceptor, disableFetchInterceptor };
