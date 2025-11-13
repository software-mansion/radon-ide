import Fetch from "react-native-fetch-api/src/Fetch";
import { AsyncBoundedResponseBuffer } from "./AsyncBoundedResponseBuffer";
import { BlobLikeResponse, getFetchResponseDataPromise } from "./networkRequestParsers";

const { Networking } = require("react-native");

const { mimeTypeFromResponseType } = require("./networkRequestParsers");

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
  private _requestId: number = 0;
  private _request: Request | null = null;
  private _nativeRequestHeaders: Record<string, string> = {};
  private _nativeResponse: Response | null = null;
  private _response: BlobLikeResponse | null = null;

  private _startTime: number = 0;
  private _ttfbTime = 0;

  private _status: number = 0;
  private _headers: Record<string, string> = {};
  private _url: string = "";

  private _streamController: ReadableStreamDefaultController<any> | null = null;
  private _textEncoder = new TextEncoder();
  private _stream: ReadableStream<any> | null = null;
  private _responseStatus: number | null = null;
  private _nativeResponseHeaders: Record<string, string> = {};
  private _responseUrl: string | null = null;

  private _networkProxy = null;
  private _responseBuffer: AsyncBoundedResponseBuffer | null = null;

  private _originalFetch: typeof fetch | null = null;

  private _original__didCreateRequest: DidCreateRequestFn = () => {};
  private _original__didReceiveNetworkResponse: DidReceiveNetworkResponseFn = () => {};
  private _original__didReceiveNetworkIncrementalData: DidReceiveNetworkIncrementalDataFn =
    () => {};
  private _original__didReceiveNetworkData: DidReceiveNetworkDataFn = () => {};
  private _original__didCompleteNetworkResponse: DidCompleteNetworkResponseFn = () => {};
  private _original__abort: () => void = () => {};

  constructor() {
    if (!this.checkCompatibility()) {
      console.warn(
        "FetchInterceptor: Incompatible environment. Fetch or Networking module not found."
      );
      return;
    }
  }

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
      self._requestId = requestId;

      // Call original with the Fetch instance context (this)
      self._original__didCreateRequest.call(this, requestId);

      // Use original fetch's `this` context to access request details
      self._startTime = Date.now();
      self._sendCDPMessage("Network.requestWillBeSent", {
        requestId: requestId,
        loaderId: "fetch-interceptor",
        timestamp: self._startTime,
        wallTime: 0,
        request: {
          url: this._request.url,
          method: this._request.method,
          headers: this._request.headers,
          postData: this._request.body,
        },
        type: this._request.type,
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

      self._streamController = this.streamController;
      self._stream = this.stream;
      self._responseStatus = this.status;
      self._nativeResponseHeaders = this.headers;
      self._responseUrl = this.url;
      self._response = this._response;
      self._status = status;
      self._headers = headers;
      self._url = url;

      self._ttfbTime = Date.now() - self._startTime;
    };
  }

  private _handleDidReceiveNetworkIncrementalData() {
    // eslint-disable-next-line
    const self = this;

    this._original__didReceiveNetworkIncrementalData =
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
      const typedArray = this._textEncoder.encode(responseText, {
        stream: true,
      });

      self._sendCDPMessage("Network.dataReceived", {
        requestId: requestId,
        loaderId: "fetch-interceptor",
        timestamp: timeStamp,
        dataLength: responseText.length,
        ttfb: self._ttfbTime,
        // check if correct
        encodedDataLength: typedArray.length,
        type: this._response.type,
        response: {
          type: this._response.type,
          url: self._url,
          status: self._status,
          headers: self._headers,
          mimeType: this._response._body._mimeType,
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

      self._nativeResponse = this._nativeResponse;
      self._response = response;

      const mimeType = mimeTypeFromResponseType(response.type);
      self._sendCDPMessage("Network.responseReceived", {
        requestId: requestId,
        loaderId: "fetch-interceptor",
        timestamp: Date.now(),
        ttfb: self._ttfbTime,
        type: response.type,
        response: {
          type: response.type,
          url: self._url,
          status: self._status,
          headers: self._headers,
          mimeType: mimeType,
        },
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
      if (requestId !== this._requestId) {
        return;
      }

      self._original__didCompleteNetworkResponse.call(this, requestId, errorMessage, didTimeOut);
      self._response = this._response?.clone();

      if (self._responseBuffer) {
        self._responseBuffer.put(
          requestId.toString(),
          getFetchResponseDataPromise(self._response, this._nativeResponseType)
        );
      }

      self._sendCDPMessage("Network.loadingFinished", {
        requestId: requestId,
        timestamp: Date.now(),
        duration: Date.now() - self._startTime,
        encodedDataLength: self._response?.size, // when response is blob, we use size, and length otherwise
      });
    };
  }

  private _handleAbort() {
    // eslint-disable-next-line
    const self = this;

    this._original__abort = Fetch.prototype.__abort;
    Fetch.prototype.__abort = function () {
      self._original__abort.call(this);

      self._sendCDPMessage("Network.loadingFailed", {
        requestId: this._requestId,
        timestamp: Date.now(),
        type: "XHR",
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
    this._originalFetch = global.fetch;

    if (!this._originalFetch) {
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

    if (this._originalFetch) {
      global.fetch = this._originalFetch;
      this._originalFetch = null;
    }

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
