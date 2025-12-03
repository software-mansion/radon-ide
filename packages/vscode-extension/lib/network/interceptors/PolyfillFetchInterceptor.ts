import { AsyncBoundedResponseBuffer } from "../AsyncBoundedResponseBuffer";
import {
  getFetchResponseDataPromise,
  deserializeRequestData,
  trimContentType,
} from "../networkRequestParsers";
import type { NetworkProxy, NativeResponseType, BlobLikeResponse } from "../types";

/**
 * Below line is replaced during the babel transformation process
 * to point to the react-native-fetch-api module if available.
 * If the package is not installed, the value is set to undefined.
 *
 * The declaration below HAS TO use this specific string to be correctly identified,
 * see lib/babel_transformer.js for more details.
 */
const Fetch: any = "__RADON_REQUIRE_FETCH__";

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

interface FetchReadableStream extends ReadableStream {
  _closedPromise: Promise<void>;
  releaseLock(): void;
}

interface FetchRequest extends Request {
  _body: Body;

  clone(): Request;
}

interface FetchResponse extends Response {
  _body: Body;

  clone(): Response;
}

interface BlobFetchResponse extends Response {
  _blobResponse: FetchResponse;
}
interface ArrayBufferFetchResponse extends Response {
  _arrayBufferResponse: FetchResponse;
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
  _response?: FetchResponse | BlobFetchResponse | ArrayBufferFetchResponse;
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

/**
 * Tracks request IDs that have received a terminal CDP event (loadingFinished or loadingFailed).
 * Used to prevent duplicate terminal events when multiple code paths
 * (e.g., stream close vs didCompleteNetworkResponse) could trigger them.
 */
class CompletedRequestTracker {
  private completedIds: Set<string> = new Set();

  /**
   * Marks a request as completed (terminal event sent).
   */
  public markCompleted(requestId: string): void {
    this.completedIds.add(requestId);
  }

  /**
   * Checks if a request has already received a terminal event.
   */
  public isCompleted(requestId: string): boolean {
    return this.completedIds.has(requestId);
  }

  /**
   * Clears all tracked request IDs. Should be called when the interceptor is disabled.
   */
  public reset(): void {
    this.completedIds.clear();
  }
}

/**
 * Manages incremental response data chunks for streaming fetch requests.
 * Accumulates Uint8Array chunks keyed by request ID for later processing.
 *
 * The chunks put on the queue come in the form of strings and are encoded to Uint8Array,
 * like in react-native-fetch-api. This allows for later handling of multi-byte characters
 * when response should be displayed as base64.
 */
class IncrementalResponseQueue {
  private queueMap: Map<string, Array<Uint8Array>> = new Map();
  // text encoder is already polyfilled when the fetch polyfill is used,
  // otherwise the fetch itself does not work
  // for RN version >= 74 the encoder should be included in Hermes
  private textEncoder = new TextEncoder();

  public getQueue(requestId: string): Array<Uint8Array> {
    if (!this.queueMap.has(requestId)) {
      this.queueMap.set(requestId, []);
    }

    return this.queueMap.get(requestId)!;
  }

  public pushToQueue(requestId: string, data: string): void {
    const encodedData = this.textEncoder.encode(data);
    const requestQueue = this.getQueue(requestId);
    requestQueue.push(encodedData);
  }

  public clearQueue(requestId: string): void {
    this.queueMap.delete(requestId);
  }

  public reset(): void {
    this.queueMap.clear();
  }

  public getResponseSize(requestId: string): number {
    const queue = this.queueMap.get(requestId);
    if (!queue) {
      return 0;
    }
    return queue.reduce((acc, chunk) => acc + chunk.length, 0);
  }
}

/**
 * Intercepts network requests made using the react-native-fetch-api polyfill package.
 * https://github.com/react-native-community/fetch
 *
 * This interceptor hooks into the Fetch.js class internal lifecycle methods to capture
 * network activity and report it via CDP-compliant messages (like XHRInterceptor). It handles three native
 * response types:
 * - "text": Streaming responses with incremental data callbacks
 * - "blob": Single callback with Blob response (default)
 * - "base64": Single callback with base64-encoded ArrayBuffer
 *
 * Should be used alongside XHRInterceptor to cover all network request types.
 * Shares AsyncBoundedResponseBuffer with XHRInterceptor for response storage.
 *
 * @see polyfill_readme.md for detailed implementation notes
 */
class PolyfillFetchInterceptor {
  private enabled: boolean = false;

  private networkProxy?: NetworkProxy = undefined;
  private responseBuffer?: AsyncBoundedResponseBuffer = undefined;

  private incrementalResponseQueue: IncrementalResponseQueue = new IncrementalResponseQueue();
  private completedRequestTracker: CompletedRequestTracker = new CompletedRequestTracker();

  // timing
  private startTime: number = 0;
  private ttfbTime = 0;

  private original__didCreateRequest: DidCreateRequestFn = () => {};
  private original__didReceiveNetworkResponse: DidReceiveNetworkResponseFn = () => {};
  private original__didReceiveNetworkIncrementalData: DidReceiveNetworkIncrementalDataFn = () => {};
  private original__didReceiveNetworkData: DidReceiveNetworkDataFn = () => {};
  private original__didCompleteNetworkResponse: DidCompleteNetworkResponseFn = () => {};
  private original__abort: () => void = () => {};

  public static isCompatible() {
    if (!Fetch?.prototype || !global.TextEncoder?.prototype) {
      return false;
    }

    const allMethodsExist = [
      Fetch.prototype.__didCreateRequest,
      Fetch.prototype.__didReceiveNetworkResponse,
      Fetch.prototype.__didReceiveNetworkIncrementalData,
      Fetch.prototype.__didReceiveNetworkData,
      Fetch.prototype.__didCompleteNetworkResponse,
      Fetch.prototype.__abort,
    ].every((method) => typeof method === "function");

    return allMethodsExist;
  }

  private setupInterceptors() {
    this.override__didCreateRequest();
    this.override__didReceiveNetworkResponse();
    this.override__didReceiveNetworkIncrementalData();
    this.override__didReceiveNetworkData();
    this.override__didCompleteNetworkResponse();
    this.override__abort();
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

  private bufferResponseBody(
    requestId: string,
    response: FetchResponse,
    nativeResponseType: NativeResponseType
  ) {
    if (!this.responseBuffer) {
      return;
    }

    // text-streaming case
    // https://github.com/react-native-community/fetch/blob/master/src/Fetch.js#L142-L157
    const isIncrementalResponse = nativeResponseType === "text";

    if (isIncrementalResponse) {
      const incrementalResponseQueue = this.incrementalResponseQueue.getQueue(requestId);

      const responseDataPromise = getFetchResponseDataPromise(
        response,
        nativeResponseType,
        incrementalResponseQueue
      );
      this.responseBuffer.put(requestId, responseDataPromise);

      this.incrementalResponseQueue.clearQueue(requestId);
    } else {
      const responseDataPromise = getFetchResponseDataPromise(response, nativeResponseType);
      this.responseBuffer.put(requestId, responseDataPromise);
    }
  }

  /**
   * Backwards compatibility handling for library 2.0.0 and 1.0.0 versions
   * See: https://github.com/react-native-community/fetch/blob/v2.0.0/src/StreamBlobResponse.js
   */
  private getCompatibleFetchResponse(
    response: FetchResponse | BlobFetchResponse | ArrayBufferFetchResponse | undefined
  ): FetchResponse | undefined {
    if (!response) {
      return undefined;
    }
    if ("_blobResponse" in response) {
      return response._blobResponse;
    }
    if ("_arrayBufferResponse" in response) {
      return response._arrayBufferResponse;
    }
    return response;
  }

  private sendLoadingFinished(
    requestId: string,
    response: FetchResponse,
    fetchInstance: PolyfillFetch,
    shouldBufferResponse: boolean
  ) {
    if (this.completedRequestTracker.isCompleted(requestId)) {
      return;
    }

    const responseHeadersContentType = response.headers.get("content-type") || "";
    const mimeType = trimContentType(response._body._mimeType || responseHeadersContentType);

    if (shouldBufferResponse) {
      this.bufferResponseBody(requestId, response, fetchInstance._nativeResponseType);
    }

    const timeStamp = Date.now();
    this.sendCDPMessage("Network.loadingFinished", {
      requestId,
      timestamp: timeStamp,
      duration: timeStamp - this.startTime,
      type: mimeType,
      response: {
        type: response.type,
        status: fetchInstance._responseStatus,
        url: fetchInstance._responseUrl,
        headers: fetchInstance._nativeResponseHeaders,
        mimeType: mimeType,
      },
      // Not sending the encodedDataLength, as we've done so in didReceiveNetworkData and didReceiveNetworkIncrementalData
    });

    this.completedRequestTracker.markCompleted(requestId);
  }

  private sendLoadingFailed(
    requestId: string,
    errorText: string,
    canceled: boolean,
    shouldClearQueue: boolean
  ) {
    if (this.completedRequestTracker.isCompleted(requestId)) {
      return;
    }

    const timeStamp = Date.now();

    if (shouldClearQueue) {
      this.incrementalResponseQueue.clearQueue(requestId);
    }

    this.sendCDPMessage("Network.loadingFailed", {
      requestId,
      timestamp: timeStamp,
      type: "",
      errorText,
      canceled,
    });

    this.completedRequestTracker.markCompleted(requestId);
  }

  private override__didCreateRequest() {
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
          headers: this._nativeRequestHeaders,
          postData: deserializeRequestData(this._request._body._bodyInit, mimeType),
        },
        type: mimeType,
        initiator: {
          type: INITIATOR_TYPE,
        },
      });
    };
  }

  /**
   * Intercepts stream.getReader() to observe stream closure via _closedPromise.
   * @see https://github.com/MattiasBuelens/web-streams-polyfill/blob/master/src/lib/readable-stream/generic-reader.ts#L60-L66
   * @see https://github.com/MattiasBuelens/web-streams-polyfill/blob/master/src/lib/readable-stream/default-reader.ts#L118-L128
   */
  private override__getReader(
    stream: ReadableStream,
    fetchInstance: PolyfillFetch,
    interceptorInstance: PolyfillFetchInterceptor
  ) {
    const original__getReader = stream.getReader;
    if (typeof original__getReader !== "function") {
      return;
    }

    // @ts-ignore - Overriding getReader to intercept stream closure
    stream.getReader = function (this: FetchReadableStream, options?: { mode?: string }) {
      // @ts-ignore - Reader has internal _closedPromise property
      const reader: FetchReadableStream = original__getReader.call(this, options);

      const _response = interceptorInstance.getCompatibleFetchResponse(fetchInstance._response);
      const closedPromise = reader._closedPromise;

      // Early exit if we can't observe stream closure
      if (!closedPromise?.then || !_response) {
        return reader;
      }

      // releaseLock causes the _closedPromise to reject,
      // so we have to make sure we can tell it apart from actual errors
      let lockReleased = false;
      const originalReleaseLock = reader.releaseLock;
      const restoreReleaseLock = () => {
        reader.releaseLock = originalReleaseLock;
      };
      reader.releaseLock = function (this) {
        if (!lockReleased) {
          lockReleased = true;
          originalReleaseLock.call(this);
        }
      };

      const requestIdStr = `${REQUEST_ID_PREFIX}-${fetchInstance._requestId}`;

      closedPromise
        .then(() => {
          restoreReleaseLock();
          if (fetchInstance._response) {
            interceptorInstance.sendLoadingFinished(requestIdStr, _response, fetchInstance, true);
          }
        })
        .catch((e: Error) => {
          restoreReleaseLock();
          const errorMessage = e.message || "Stream error";
          if (!lockReleased) {
            interceptorInstance.sendLoadingFailed(requestIdStr, errorMessage, false, true);
          }
        });

      return reader;
    };
  }

  private override__didReceiveNetworkResponse() {
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

      // stream and streamController are created and assigned in __didReceiveNetworkResponse
      // https://github.com/react-native-community/fetch/blob/master/src/Fetch.js#L130-L157
      if (this._stream) {
        self.override__getReader(this._stream, this, self);
      }
    };
  }

  private override__didReceiveNetworkIncrementalData() {
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
      self.original__didReceiveNetworkIncrementalData.call(
        this,
        requestId,
        responseText,
        progress,
        total
      );

      const _response = self.getCompatibleFetchResponse(this._response);

      if (requestId !== this._requestId || !_response) {
        return;
      }

      const timeStamp = Date.now();
      const mimeType = trimContentType(_response._body._mimeType);
      const requestIdStr = `${REQUEST_ID_PREFIX}-${requestId}`;

      // https://github.com/react-native-community/fetch/blob/master/src/Fetch.js#L168-L188
      self.incrementalResponseQueue.pushToQueue(requestIdStr, responseText);

      const eventMessageSize = total <= 0 ? progress : total;
      const messageSize =
        eventMessageSize < 0
          ? self.incrementalResponseQueue.getResponseSize(requestIdStr)
          : eventMessageSize;

      self.sendCDPMessage("Network.dataReceived", {
        requestId: requestIdStr,
        loaderId: LOADER_ID,
        timestamp: timeStamp,
        dataLength: responseText.length,
        ttfb: self.ttfbTime,
        type: mimeType,
        response: {
          type: _response.type,
          status: this._responseStatus,
          url: this._responseUrl,
          headers: this._nativeResponseHeaders,
        },
        encodedDataLength: messageSize,
      });
    };
  }

  private override__didReceiveNetworkData() {
    // eslint-disable-next-line
    const self = this;

    self.original__didReceiveNetworkData = Fetch.prototype.__didReceiveNetworkData;
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

  private override__didCompleteNetworkResponse() {
    // eslint-disable-next-line
    const self = this;
    self.original__didCompleteNetworkResponse = Fetch.prototype.__didCompleteNetworkResponse;

    Fetch.prototype.__didCompleteNetworkResponse = async function (
      this: PolyfillFetch,
      requestId: number,
      errorMessage: string,
      didTimeOut: boolean
    ) {
      await self.original__didCompleteNetworkResponse.call(
        this,
        requestId,
        errorMessage,
        didTimeOut
      );

      const _response = self.getCompatibleFetchResponse(this._response);

      if (requestId !== this._requestId || !_response) {
        return;
      }

      const requestIdStr = `${REQUEST_ID_PREFIX}-${requestId}`;

      // send loadingFailed and return early
      if (didTimeOut || errorMessage) {
        return self.sendLoadingFailed(
          requestIdStr,
          errorMessage || "Timeout",
          false, // canceled
          true // shouldClearQueue
        );
      }
      self.sendLoadingFinished(
        requestIdStr,
        _response,
        this,
        true // shouldBufferResponse
      );
    };
  }

  private override__abort() {
    // eslint-disable-next-line
    const self = this;
    self.original__abort = Fetch.prototype.__abort;

    Fetch.prototype.__abort = function (this: PolyfillFetch) {
      self.original__abort.call(this);

      const requestIdStr = `${REQUEST_ID_PREFIX}-${this._requestId}`;

      self.sendLoadingFailed(
        requestIdStr,
        "Aborted",
        true, // canceled
        true // shouldClearQueue
      );
    };
  }

  public enable(networkProxy: NetworkProxy, responseBuffer: AsyncBoundedResponseBuffer) {
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
    this.incrementalResponseQueue.reset();
    this.completedRequestTracker.reset();

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
}

let interceptorInstance: PolyfillFetchInterceptor | undefined = undefined;

export function enableInterception(
  networkProxy: NetworkProxy,
  responseBuffer: AsyncBoundedResponseBuffer
): void {
  if (!PolyfillFetchInterceptor.isCompatible()) {
    return;
  }

  if (!interceptorInstance) {
    interceptorInstance = new PolyfillFetchInterceptor();
  }

  interceptorInstance.enable(networkProxy, responseBuffer);
}

export function disableInterception(): void {
  interceptorInstance?.disable();
}

module.exports = {
  enableInterception,
  disableInterception,
};
