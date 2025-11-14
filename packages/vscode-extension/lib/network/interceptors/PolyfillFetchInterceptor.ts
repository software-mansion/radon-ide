import { AsyncBoundedResponseBuffer } from "../AsyncBoundedResponseBuffer";
import {
  getFetchResponseDataPromise,
  deserializeRequestData,
  trimContentType,
} from "../networkRequestParsers";
import type { NetworkProxy, NativeResponseType, BlobLikeResponse } from "../types";

let Fetch: any = undefined;
try {
  Fetch = require("react-native-fetch-api/src/Fetch")?.default;
} catch {}

type BodyInit =
  | Blob
  | FormData
  | URLSearchParams
  | ArrayBuffer
  | ArrayBufferView
  | ReadableStream<Uint8Array>
  | string;

interface Body {
  readonly body: ReadableStream<Uint8Array>;
  bodyUsed: boolean;

  // Internal properties
  _bodyInit?: BodyInit;
  _bodyText?: string;
  _bodyBlob?: Blob;
  _bodyFormData?: FormData;
  _bodyArrayBuffer?: ArrayBuffer;
  _bodyReadableStream?: ReadableStream<Uint8Array>;
  _mimeType?: string;

  blob(): Promise<Blob>;
  arrayBuffer(): Promise<ArrayBuffer>;
  text(): Promise<string>;
  json<T = unknown>(): Promise<T>;
  formData(): Promise<FormData>;
}

interface FetchRequest extends Request {
  _body: Body;

  clone(): Request;
}

interface FetchResponse extends Response {
  _body: Body;

  clone(): Response;
}

interface DeferredPromise<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
}

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
type DidReceiveNetworkDataFn = (requestId: number, response: BlobLikeResponse | string) => void;
type DidCompleteNetworkResponseFn = (
  requestId: number,
  errorMessage: string,
  didTimeOut: boolean
) => void;

interface PolyfillFetch {
  // Internal properties
  _nativeNetworkSubscriptions: Set<() => void>;
  _nativeResponseType: NativeResponseType;
  _nativeRequestHeaders: Record<string, string>;
  _nativeResponseHeaders: Record<string, string>;
  _nativeRequestTimeout: number;
  _nativeResponse?: BlobLikeResponse | string;
  _textEncoder: TextEncoder;
  _requestId?: number;
  _request: FetchRequest;
  _response?: FetchResponse;
  _streamController?: ReadableStreamDefaultController<Uint8Array>;
  _stream?: ReadableStream<Uint8Array>;
  _deferredPromise: DeferredPromise<Response>;
  _responseStatus: number;
  _responseUrl: string;
  _abortFn?: () => void;
}

const LOADER_ID = "fetch-interceptor";
const INITIATOR_TYPE = "script";
const REQUEST_ID_PREFIX = "FETCH";

class PolyfillFetchInterceptor {
  private enabled: boolean = false;

  private networkProxy?: NetworkProxy = undefined;
  private responseBuffer?: AsyncBoundedResponseBuffer = undefined;

  // timing
  private startTime: number = 0;
  private ttfbTime = 0;

  private original__didCreateRequest: DidCreateRequestFn = () => {};
  private original__didReceiveNetworkResponse: DidReceiveNetworkResponseFn = () => {};
  private original__didReceiveNetworkIncrementalData: DidReceiveNetworkIncrementalDataFn = () => {};
  private original__didReceiveNetworkData: DidReceiveNetworkDataFn = () => {};
  private original__didCompleteNetworkResponse: DidCompleteNetworkResponseFn = () => {};
  private original__abort: () => void = () => {};

  private checkCompatibility() {
    return !!Fetch;
  }

  private setupInterceptors() {
    this.handleDidCreateRequest();
    this.handleDidReceiveNetworkResponse();
    this.handleDidReceiveNetworkIncrementalData();
    this.handleDidReceiveNetworkData();
    this.handleDidCompleteNetworkResponse();
    this.handleAbort();
  }

  private cleanupInterceptors() {
    Fetch.prototype.__didCreateRequest = this.original__didCreateRequest;
    Fetch.prototype.__didReceiveNetworkResponse = this.original__didReceiveNetworkResponse;
    Fetch.prototype.__didReceiveNetworkIncrementalData =
      this.original__didReceiveNetworkIncrementalData;
    Fetch.prototype.__didReceiveNetworkData = this.original__didReceiveNetworkData;
    Fetch.prototype.__didCompleteNetworkResponse = this.original__didCompleteNetworkResponse;
    Fetch.prototype.__abort = this.original__abort;

    this.original__didCreateRequest = () => {};
    this.original__didReceiveNetworkResponse = () => {};
    this.original__didReceiveNetworkIncrementalData = () => {};
    this.original__didReceiveNetworkData = () => {};
    this.original__didCompleteNetworkResponse = () => {};
    this.original__abort = () => {};
  }

  private handleDidCreateRequest() {
    // eslint-disable-next-line
    const self = this;
    self.original__didCreateRequest = Fetch.prototype.__didCreateRequest;

    Fetch.prototype.__didCreateRequest = function (requestId: number) {
      self.original__didCreateRequest.call(this, requestId);

      const mimeType = trimContentType(this._request._body._mimeType);
      self.startTime = Date.now();
      const requestIdStr = `${REQUEST_ID_PREFIX}-${requestId}`;

      self.sendCDPMessage("Network.requestWillBeSent", {
        requestId: requestIdStr,
        loaderId: LOADER_ID,
        timestamp: self.startTime,
        wallTime: Date.now(),
        request: {
          url: this._request.url,
          method: this._request.method,
          headers: this._request.headers,
          postData: deserializeRequestData(this._request._body._bodyInit, mimeType),
        },
        type: mimeType,
        initiator: {
          type: INITIATOR_TYPE,
        },
      });
    };
  }

  private handleDidReceiveNetworkResponse() {
    // eslint-disable-next-line
    const self = this;
    self.original__didReceiveNetworkResponse = Fetch.prototype.__didReceiveNetworkResponse;

    Fetch.prototype.__didReceiveNetworkResponse = function (
      this: PolyfillFetch,
      requestId: number,
      status: number,
      headers: Record<string, string>,
      url: string
    ) {
      self.original__didReceiveNetworkResponse?.call(this, requestId, status, headers, url);

      if (requestId !== this._requestId) {
        return;
      }

      self.ttfbTime = Date.now() - self.startTime;
    };
  }

  private handleDidReceiveNetworkIncrementalData() {
    // eslint-disable-next-line
    const self = this;
    self.original__didReceiveNetworkIncrementalData =
      Fetch.prototype.__didReceiveNetworkIncrementalData;

    Fetch.prototype.__didReceiveNetworkIncrementalData = function (
      this: PolyfillFetch,
      requestId: number,
      responseText: string,
      progress: number,
      total: number
    ) {
      if (requestId !== this._requestId) {
        return;
      }

      self.original__didReceiveNetworkIncrementalData.call(
        this,
        requestId,
        responseText,
        progress,
        total
      );

      if (!this._response) {
        return;
      }

      const timeStamp = Date.now();
      const mimeType = trimContentType(this._response._body._mimeType);
      const requestIdStr = `${REQUEST_ID_PREFIX}-${requestId}`;

      self.sendCDPMessage("Network.dataReceived", {
        requestId: requestIdStr,
        loaderId: LOADER_ID,
        timestamp: timeStamp,
        dataLength: responseText.length,
        ttfb: self.ttfbTime,
        encodedDataLength: total <= 0 ? progress : total,
        type: mimeType,
        response: {
          type: this._response.type,
          status: this._responseStatus,
          url: this._responseUrl,
          headers: this._nativeResponseHeaders,
        },
      });
    };
  }

  private handleDidReceiveNetworkData() {
    // eslint-disable-next-line
    const self = this;

    this.original__didReceiveNetworkData = Fetch.prototype.__didReceiveNetworkData;
    Fetch.prototype.__didReceiveNetworkData = function (
      this: PolyfillFetch,
      requestId: number,
      response: BlobLikeResponse | string
    ) {
      self.original__didReceiveNetworkData.call(this, requestId, response);
      if (requestId !== this._requestId || !this._nativeResponse) {
        return;
      }

      const timeStamp = Date.now();
      const requestIdStr = `${REQUEST_ID_PREFIX}-${requestId}`;

      self.sendCDPMessage("Network.responseReceived", {
        requestId: requestIdStr,
        loaderId: LOADER_ID,
        timestamp: timeStamp,
        ttfb: self.ttfbTime,
        type: typeof response === "string" ? "text" : response.type,
        response: {
          type: "basic",
          status: this._responseStatus,
          url: this._responseUrl,
          headers: this._nativeResponseHeaders,
        },
        // @ts-ignore
        encodedDataLength: this._nativeResponse?.size || this._nativeResponse?.length,
      });
    };
  }

  private handleDidCompleteNetworkResponse() {
    // eslint-disable-next-line
    const self = this;
    self.original__didCompleteNetworkResponse = Fetch.prototype.__didCompleteNetworkResponse;

    Fetch.prototype.__didCompleteNetworkResponse = function (
      this: PolyfillFetch,
      requestId: number,
      errorMessage: string,
      didTimeOut: boolean
    ) {
      self.original__didCompleteNetworkResponse.call(this, requestId, errorMessage, didTimeOut);

      if (requestId !== this._requestId || !this._response) {
        return;
      }

      const timeStamp = Date.now();
      const requestIdStr = `${REQUEST_ID_PREFIX}-${requestId}`;

      // send loadingFailed and return early
      if (didTimeOut || errorMessage) {
        return self.sendCDPMessage("Network.loadingFailed", {
          requestId: requestIdStr,
          timestamp: timeStamp,
          type: "",
          errorText: errorMessage || "Timeout",
          canceled: false,
        });
      }

      self.responseBuffer?.put(
        requestIdStr,
        getFetchResponseDataPromise(this._response, this._nativeResponseType)
      );

      const mimeType = trimContentType(this._response._body._mimeType);

      self.sendCDPMessage("Network.loadingFinished", {
        requestId: requestIdStr,
        timestamp: timeStamp,
        duration: timeStamp - self.startTime,
        type: mimeType,
        // additionally setting the response here, as here we have complete reponse information
        response: {
          type: this._response.type,
          status: this._responseStatus,
          url: this._responseUrl,
          headers: this._nativeResponseHeaders,
          mimeType: mimeType,
        },
        // Not sending the ecnodedDataLength, as we've done so in didReceiveNetworkData and didReceiveNetworkIncrementalData
      });
    };
  }

  private handleAbort() {
    // eslint-disable-next-line
    const self = this;
    self.original__abort = Fetch.prototype.__abort;

    Fetch.prototype.__abort = function (this: PolyfillFetch) {
      self.original__abort.call(this);

      const timeStamp = Date.now();
      const requestIdStr = `${REQUEST_ID_PREFIX}-${this._requestId}`;

      self.sendCDPMessage("Network.loadingFailed", {
        requestId: requestIdStr,
        timestamp: timeStamp,
        type: "",
        errorText: "Aborted",
        canceled: true,
      });
    };
  }

  public enable(networkProxy: NetworkProxy, responseBuffer: AsyncBoundedResponseBuffer) {
    if (this.enabled || !this.checkCompatibility() || !global.fetch) {
      return;
    }

    this.networkProxy = networkProxy;
    this.responseBuffer = responseBuffer;

    this.setupInterceptors();
    this.enabled = true;
  }

  public disable() {
    if (!this.enabled) {
      return;
    }

    this.cleanupInterceptors();

    this.networkProxy = undefined;
    this.responseBuffer = undefined;
    this.enabled = false;
  }

  private sendCDPMessage(method: string, params: Record<string, unknown>) {
    if (!this.networkProxy) {
      return;
    }
    this.networkProxy.sendMessage("cdp-message", JSON.stringify({ method, params }));
  }

  /**
   * Check if interceptor is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }
}

let interceptorInstance: PolyfillFetchInterceptor = new PolyfillFetchInterceptor();

export function enableInterception(
  networkProxy: NetworkProxy,
  responseBuffer: AsyncBoundedResponseBuffer
): void {
  if (!interceptorInstance) {
    interceptorInstance = new PolyfillFetchInterceptor();
  }

  if (!interceptorInstance.isEnabled()) {
    interceptorInstance.enable(networkProxy, responseBuffer);
  }
}

export function disableInterception(): void {
  if (interceptorInstance && interceptorInstance.isEnabled()) {
    interceptorInstance.disable();
  }
}

module.exports = {
  enableInterception,
  disableInterception,
};
