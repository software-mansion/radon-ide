import { AsyncBoundedResponseBuffer } from "../AsyncBoundedResponseBuffer";
import {
  getFetchResponseDataPromise,
  deserializeRequestData,
  trimContentType,
  // getIncrementalFetchResponseDataPromise,
} from "../networkRequestParsers";
import type { NetworkProxy, NativeResponseType, BlobLikeResponse } from "../types";

/**
 * Below line is replaced during the babel transformation process
 * to point to the react-native-fetch-api module if available.
 * If the package is not installed, the value is set to undefined.
 * 
 * The declaration below *HAS TO* start with "const Fetch" to be correctly identified,
 * see lib/babel_transformer.js for more details.
 */
const Fetch: any = undefined;

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

  public resetQueue(): void {
    this.queueMap.clear();
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

  // https://github.com/MattiasBuelens/web-streams-polyfill/blob/master/src/lib/readable-stream/generic-reader.ts#L60-L66
  // https://github.com/MattiasBuelens/web-streams-polyfill/blob/master/src/lib/readable-stream/default-reader.ts#L118-L128
  // Observes stream closure via the internal _closedPromise, which is accessed normally bu closed() method
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

      const closedPromise = reader._closedPromise;
      if (!closedPromise?.then) {
        return reader;
      }

      const timeStamp = Date.now();
      const requestIdStr = `${REQUEST_ID_PREFIX}-${fetchInstance._requestId}`;

      const handleStreamClosed = () => {
        if (!fetchInstance._response) {
          return;
        }

        interceptorInstance.bufferResponseBody(
          requestIdStr,
          fetchInstance._response,
          fetchInstance._nativeResponseType
        );

        const mimeType = trimContentType(fetchInstance._response._body._mimeType);

        interceptorInstance.sendCDPMessage("Network.loadingFinished", {
          requestId: requestIdStr,
          timestamp: timeStamp,
          duration: timeStamp - interceptorInstance.startTime,
          type: mimeType,
          response: {
            type: fetchInstance._response.type,
            status: fetchInstance._responseStatus,
            url: fetchInstance._responseUrl,
            headers: fetchInstance._nativeResponseHeaders,
            mimeType: mimeType,
          },
          // Not sending the ecnodedDataLength, as we've done so in didReceiveNetworkData and didReceiveNetworkIncrementalData
        });
      };

      const handleStreamError = (e: Error) => {
        interceptorInstance.incrementalResponseQueue.clearQueue(requestIdStr);
        interceptorInstance.sendCDPMessage("Network.loadingFailed", {
          requestId: requestIdStr,
          timestamp: timeStamp,
          type: "",
          errorText: e.message || "Stream error",
          canceled: false,
        });
      };

      closedPromise.then(handleStreamClosed).catch(handleStreamError);

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

      // https://github.com/react-native-community/fetch/blob/master/src/Fetch.js#L168-L188
      self.incrementalResponseQueue.pushToQueue(requestIdStr, responseText);

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
        self.incrementalResponseQueue.clearQueue(requestIdStr);
        return self.sendCDPMessage("Network.loadingFailed", {
          requestId: requestIdStr,
          timestamp: timeStamp,
          type: "",
          errorText: errorMessage || "Timeout",
          canceled: false,
        });
      }

      self.bufferResponseBody(requestIdStr, this._response, this._nativeResponseType);

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

  private override__abort() {
    // eslint-disable-next-line
    const self = this;
    self.original__abort = Fetch.prototype.__abort;

    Fetch.prototype.__abort = function (this: PolyfillFetch) {
      self.original__abort.call(this);

      const timeStamp = Date.now();
      const requestIdStr = `${REQUEST_ID_PREFIX}-${this._requestId}`;

      self.incrementalResponseQueue.clearQueue(requestIdStr);

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
    this.incrementalResponseQueue.resetQueue();

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
