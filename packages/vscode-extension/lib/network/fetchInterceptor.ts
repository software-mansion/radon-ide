import Fetch from "react-native-fetch-api/src/Fetch";
const { Networking } = require("react-native");

const { PluginMessageBridge } = require("../plugins/PluginMessageBridge");

interface InterceptedRequestInfo {
  id: number;
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | Blob | ArrayBuffer | FormData | URLSearchParams | null;
  reactNative?: unknown;
  credentials?: globalThis.RequestCredentials;
  signal?: AbortSignal;
  timestamp: number;
}

interface InterceptedResponseInfo extends InterceptedRequestInfo {
  status: number;
  statusText: string;
  ok: boolean;
  type: globalThis.ResponseType;
  redirected: boolean;
  duration: number;
  // Cloned response available for callbacks that need to read the body
  // The original response is returned to the caller for streaming
  _clonedResponse?: Response;
}

interface InterceptedErrorInfo extends InterceptedRequestInfo {
  error: Error;
  errorMessage: string;
  errorName: string;
  duration: number;
}

class FetchInterceptor {
  private _enabled: boolean = false;
  private _requestId: number = 0;
  private _request: Request | null = null;
  private _nativeRequestHeaders: Record<string, string> = {};

  private _networkProxy = null;

  private _errorCallbacks: Array<(errorInfo: InterceptedErrorInfo) => void> = [];
  private _responseCallbacks: Array<(responseInfo: InterceptedResponseInfo) => void> = [];
  private _requestCallbacks: Array<(requestInfo: InterceptedRequestInfo) => void> = [];
  private _originalFetch: typeof fetch | null = null;

  private _nativeNetworkSubscriptions: Set<unknown> = new Set();

  constructor() {
    console.log(Fetch.prototype.__subscribeToNetworkEvents);
    Fetch.prototype.__subscribeToNetworkEvents.call(this);

    const original__didCreateRequest = Fetch.prototype.__didCreateRequest;
    const self = this; // Capture the FetchInterceptor instance

    Fetch.prototype.__didCreateRequest = function (this: any, requestId: number) {
      self._requestId = requestId;

      // Call original with the Fetch instance context (this)
      original__didCreateRequest.call(this, requestId);

      // Use original fetch's `this` context to access request details
      const startTime = Date.now();
      self._sendCDPMessage("Network.requestWillBeSent", {
        requestId: requestId,
        loaderId: "fetch-interceptor",
        timestamp: startTime,
        wallTime: 0,
        request: {
          url: this._request.url,
          method: this._request.method,
          headers: this._request.headers,
          postData: this._request.body,
        },
        type: "fetch",
        initiator: {
          type: "script",
        },
      });

    };
  }

  private checkCompatibility() {
    if (!Fetch || !Networking) {
      return false;
    }
    return true;
  }

  public enable(networkProxy: any) {
    if (this._enabled || !this.checkCompatibility()) {
      return;
    }

    this._networkProxy = networkProxy;
    this._originalFetch = global.fetch;

    if (!this._originalFetch) {
      return;
    }

    // Replace global fetch with intercepted version
    global.fetch = (resource, options = {}) => {
      this._request = new Request(resource, options);
      for (const [name, value] of this._request.headers.entries()) {
        this._nativeRequestHeaders[name] = value;
      }

      //   const requestInfo = this._extractRequestInfo(resource, options, requestId);
      //   this._notifyRequestCallbacks(requestInfo);

      const fetchPromise = this._originalFetch!(resource, options);

      for (const [name, value] of this._request.headers.entries()) {
        this._nativeRequestHeaders[name] = value;
      }

      return fetchPromise;
    };

    // Preserve original fetch properties if any
    Object.keys(this._originalFetch).forEach((key) => {
      // @ts-expect-error - Dynamic property copying
      global.fetch[key] = this._originalFetch[key];
    });

    this._enabled = true;
  }

  public disable() {
    if (!this._enabled) {
      return;
    }

    if (this._originalFetch) {
      global.fetch = this._originalFetch;
      this._originalFetch = null;
    }

    this._enabled = false;
  }

  private _sendCDPMessage(method, params) {
    if (!this._networkProxy) {
      return;
    }
    console.log(method, params);
    this._networkProxy.sendMessage("cdp-message", JSON.stringify({ method, params }));
  }

  /**
   * Register a callback for request interception
   * @param {Function} callback - Called with request info
   */
  onRequest(callback: (requestInfo: InterceptedRequestInfo) => void): void {
    if (typeof callback !== "function") {
      throw new TypeError("Callback must be a function");
    }
    this._requestCallbacks.push(callback);
  }

  /**
   * Register a callback for response interception
   * @param {Function} callback - Called with response info
   */
  onResponse(callback: (responseInfo: InterceptedResponseInfo) => void): void {
    if (typeof callback !== "function") {
      throw new TypeError("Callback must be a function");
    }
    this._responseCallbacks.push(callback);
  }

  /**
   * Register a callback for error interception
   * @param {Function} callback - Called with error info
   */
  onError(callback: (errorInfo: InterceptedErrorInfo) => void): void {
    if (typeof callback !== "function") {
      throw new TypeError("Callback must be a function");
    }
    this._errorCallbacks.push(callback);
  }

  /**
   * Clear all callbacks
   */
  clearCallbacks(): void {
    this._requestCallbacks = [];
    this._responseCallbacks = [];
    this._errorCallbacks = [];
  }

  /**
   * Check if interceptor is enabled
   */
  isEnabled(): boolean {
    return this._enabled;
  }

  /**
   * Handler for request creation
   */
  __didCreateRequest(requestId: number): void {
    console.log("hello __didCreateRequest", { requestId });
  }

  /**
   * Handler for network response received
   */
  __didReceiveNetworkResponse(
    requestId: number,
    status: number,
    headers: Record<string, string>,
    url: string
  ): void {
    console.log("hello __didReceiveNetworkResponse", { requestId, status, headers, url });

    if (requestId !== this._requestId) {
      return;
    }
  }

  /**
   * Handler for complete network data received
   */
  __didReceiveNetworkData(requestId: number, response: string): void {
    console.log("hello __didReceiveNetworkData", { requestId, response });
  }

  /**
   * Handler for incremental network data received
   */
  __didReceiveNetworkIncrementalData(
    requestId: number,
    responseText: string,
    progress: number,
    total: number
  ): void {
    console.log("hello __didReceiveNetworkIncrementalData", {
      requestId,
      responseText,
      progress,
      total,
    });
  }

  /**
   * Handler for network response completion
   */
  __didCompleteNetworkResponse(requestId: number, errorMessage: string, didTimeOut: boolean): void {
    console.log("hello __didCompleteNetworkResponse", { requestId, errorMessage, didTimeOut });
  }

  /**
   * Extract request information
   */
  _extractRequestInfo(
    resource: globalThis.RequestInfo | URL | string,
    options: globalThis.RequestInit,
    requestId: number
  ): InterceptedRequestInfo {
    let url = "";
    let method = "GET";
    let headers: Record<string, string> = {};
    let body: InterceptedRequestInfo["body"] = null;

    // Handle Request object or URL string
    if (typeof resource === "string") {
      url = resource;
    } else if (resource instanceof URL) {
      url = resource.toString();
    } else if (resource && typeof resource === "object") {
      // It's a Request object
      url = resource.url || "";
      method = resource.method || "GET";
      headers = this._extractHeaders(resource.headers);
      // Note: body from Request object is usually already consumed
    }

    // Override with options if provided
    if (options) {
      method = options.method || method;
      if (options.headers) {
        headers = this._extractHeaders(options.headers);
      }
      body = (options.body as InterceptedRequestInfo["body"]) || body;
    }

    return {
      id: requestId,
      url,
      method: method.toUpperCase(),
      headers,
      body,
      reactNative: (options as unknown as { reactNative?: unknown })?.reactNative,
      credentials: options?.credentials,
      signal: options?.signal || undefined,
      timestamp: Date.now(),
    };
  }

  /**
   * Extract response information
   */
  _extractResponseInfo(
    response: Response,
    requestInfo: InterceptedRequestInfo,
    duration: number
  ): InterceptedResponseInfo {
    return {
      ...requestInfo,
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      type: response.type,
      url: response.url,
      redirected: response.redirected,
      headers: this._extractHeaders(response.headers),
      duration,
      timestamp: Date.now(),
      _clonedResponse: response, // Store the cloned response for callbacks
    };
  }

  /**
   * Extract headers from Headers object
   */
  _extractHeaders(headers: globalThis.HeadersInit | undefined): Record<string, string> {
    const result: Record<string, string> = {};

    if (!headers) {
      return result;
    }

    Object.keys(headers).forEach((key) => {
      result[key] = (headers as Record<string, string>)[key];
    });

    return result;
  }

  /**
   * Notify all request callbacks
   */
  _notifyRequestCallbacks(requestInfo: InterceptedRequestInfo): void {
    this._requestCallbacks.forEach((callback) => {
      try {
        callback(requestInfo);
      } catch (error) {
        console.error("Error in request callback:", error);
      }
    });
  }

  /**
   * Notify all response callbacks
   */
  _notifyResponseCallbacks(responseInfo: InterceptedResponseInfo): void {
    this._responseCallbacks.forEach((callback) => {
      try {
        callback(responseInfo);
      } catch (error) {
        console.error("Error in response callback:", error);
      }
    });
  }

  /**
   * Notify all error callbacks
   */
  _notifyErrorCallbacks(errorInfo: InterceptedErrorInfo): void {
    this._errorCallbacks.forEach((callback) => {
      try {
        callback(errorInfo);
      } catch (error) {
        console.error("Error in error callback:", error);
      }
    });
  }
}

let interceptorInstance: FetchInterceptor | null = new FetchInterceptor();

export function enableFetchInterceptor(networkProxy: any): void {
  if (!interceptorInstance) {
    throw new Error("FetchInterceptor instance not created. Call createFetchInterceptor() first.");
  }

  if (!interceptorInstance.isEnabled()) {
    interceptorInstance.enable(networkProxy);
  }
}

export function disableFetchInterceptor(): void {
  if (interceptorInstance && interceptorInstance.isEnabled()) {
    interceptorInstance.disable();
  }
}

export function createFetchInterceptor(): FetchInterceptor {
  if (interceptorInstance) {
    return interceptorInstance;
  }
  return new FetchInterceptor();
}

module.exports = { enableFetchInterceptor, disableFetchInterceptor };
