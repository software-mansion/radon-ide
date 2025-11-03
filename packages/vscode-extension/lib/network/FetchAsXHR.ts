/**
 * XHR ReadyState constants
 * Matches the standard XMLHttpRequest.readyState values
 */
const enum XHRReadyState {
  UNSENT = 0,
  OPENED = 1,
  HEADERS_RECEIVED = 2,
  LOADING = 3,
  DONE = 4,
}

/**
 * Progress event interface matching ProgressEvent
 */
interface ProgressEventData {
  lengthComputable: boolean;
  loaded: number;
  total: number;
}

/**
 * A wrapper class that mimics XMLHttpRequest behavior using the Fetch API.
 * This provides XHR-style event handlers and state management while using modern fetch underneath.
 *
 * Can be used as a global fetch interceptor similar to XHRInterceptor pattern.
 */
class FetchAsXHR {
  // XHR event handlers - matching XMLHttpRequest signatures
  onreadystatechange: (() => void) | null = null;
  onloadstart: (() => void) | null = null;
  onprogress: ((event: ProgressEventData) => void) | null = null;
  onload: (() => void) | null = null;
  onloadend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  ontimeout: (() => void) | null = null;

  // XHR properties
  readyState: XHRReadyState = XHRReadyState.UNSENT;
  status = 0;
  statusText = "";
  response: Blob | undefined;
  responseText = "";
  responseURL = "";

  // XHR-like properties for compatibility
  _url = "";
  _method = "";
  _headers: Record<string, string> = {};
  _response: ArrayBuffer | Blob | string | null = null;
  _original_response: Response = new Response();
  responseType: string = "";
  responseHeaders: Record<string, string> = {};
  _aborted = false;
  _error = false;

  // Internal state
  private _controller: AbortController | null = null;
  private static _isIntercepting = false;
  private static _originalFetch: typeof fetch | null = null;
  private static _sendCallback:
    | ((
        data: string | Blob | ArrayBuffer | FormData | URLSearchParams | null | undefined,
        fetchXHR: FetchAsXHR
      ) => void)
    | null = null;

  constructor() {
    this.readyState = XHRReadyState.UNSENT;
  }

  /**
   * Enable global fetch interception (like XHRInterceptor.enableInterception)
   */
  static enableInterception(): void {
    if (FetchAsXHR._isIntercepting) {
      return;
    }

    FetchAsXHR._originalFetch = global.fetch;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    global.fetch = async function (input: any, init?: any): Promise<Response> {
      const url =
        typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const method = init?.method || "GET";
      const headers: Record<string, string> = {};

      if (init?.headers) {
        if (init.headers instanceof Headers) {
          init.headers.forEach((value: string, key: string) => {
            headers[key] = value;
          });
        } else if (typeof init.headers === "object") {
          Object.assign(headers, init.headers);
        }
      }

      const fetchXHR = new FetchAsXHR();
      fetchXHR._url = url;
      fetchXHR._method = method;
      fetchXHR._headers = headers;

      // Call the send callback if registered (like XHRInterceptor pattern)
      FetchAsXHR._sendCallback?.(init?.body, fetchXHR);

      fetchXHR.open(method, url);

      // Execute the fetch and return original Response
      await fetchXHR.send(init?.body);

      return fetchXHR._original_response;
    };

    FetchAsXHR._isIntercepting = true;
  }

  /**
   * Disable global fetch interception (like XHRInterceptor.disableInterception)
   */
  static disableInterception(): void {
    if (!FetchAsXHR._isIntercepting || !FetchAsXHR._originalFetch) {
      return;
    }

    global.fetch = FetchAsXHR._originalFetch;
    FetchAsXHR._originalFetch = null;
    FetchAsXHR._isIntercepting = false;
  }

  /**
   * Set callback for fetch interception (like XHRInterceptor.setSendCallback)
   */
  static setSendCallback(
    callback: (
      data: string | Blob | ArrayBuffer | FormData | URLSearchParams | null | undefined,
      fetchXHR: FetchAsXHR
    ) => void
  ): void {
    FetchAsXHR._sendCallback = callback;
  }

  private _changeReadyState(state: XHRReadyState): void {
    this.readyState = state;
    this.onreadystatechange?.();
  }

  open(method: string, url: string): void {
    this._method = method;
    this._url = url;
    this._changeReadyState(XHRReadyState.OPENED);
  }

  abort(): void {
    this._aborted = true;
    this._controller?.abort();
  }

  /**
   * Get response header value (XHR compatibility)
   */
  getResponseHeader(name: string): string | null {
    const lowerName = name.toLowerCase();
    for (const [key, value] of Object.entries(this.responseHeaders)) {
      if (key.toLowerCase() === lowerName) {
        return value;
      }
    }
    return null;
  }
  
  /**
   * Add event listener (XHR compatibility)
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  addEventListener(event: string, handler: (...args: any[]) => void): void {
    switch (event) {
      case "abort":
        this.onabort = handler;
        break;
      case "error":
        this.onerror = handler;
        break;
      case "load":
        this.onload = handler;
        break;
      case "loadend":
        this.onloadend = handler;
        break;
      case "loadstart":
        this.onloadstart = handler;
        break;
      case "progress":
        this.onprogress = handler;
        break;
      case "readystatechange":
        this.onreadystatechange = handler;
        break;
      default:
        break;
    }
  }

  async send(
    body: string | ArrayBuffer | Blob | FormData | URLSearchParams | null = null
  ): Promise<void> {
    if (this.readyState !== XHRReadyState.OPENED) {
      throw new Error("XHR has not been opened.");
    }

    this._controller = new AbortController();

    this.onloadstart?.();

    try {
      // THE ACTUAL FETCH CALL HAPPENS HERE - Use original fetch to avoid infinite recursion
      const fetchToUse = FetchAsXHR._originalFetch || fetch;
      const response = await fetchToUse(this._url, {
        method: this._method,
        body: body,
        signal: this._controller.signal,
      });

      this._original_response = response;

      this.status = response.status;
      this.statusText = response.statusText;
      this.responseURL = response.url;

      // Parse response headers
      response.headers.forEach((value, key) => {
        this.responseHeaders[key] = value;
      });

      this._changeReadyState(XHRReadyState.HEADERS_RECEIVED);

      // Transition to LOADING state
      this._changeReadyState(XHRReadyState.LOADING);

      // Simply await the response body
      const blob = await response.blob();
      // console.log(response)
      // console.log(Array.from(arrayBuffer))
      this.response = blob;
      this.responseType = "blob";
      this._response = blob;

      // TODO, see if it is necessary
      this.responseText = "done";

      // Transition to DONE state
      this._changeReadyState(XHRReadyState.DONE);

      // Fire 'load' - XHR fires load for any completed request (both 2xx and non-2xx)
      this.onload?.();
    } catch (error) {
      // Transition to DONE state even on error
      this._changeReadyState(XHRReadyState.DONE);

      if (error instanceof Error) {
        if (error.name === "AbortError") {
          this.onabort?.();
        }
      } else {
        this.onerror?.();
      }
    } finally {
      // Fire 'loadend' regardless of success or failure
      this.onloadend?.();
    }
  }
}

export { FetchAsXHR, XHRReadyState, ProgressEventData };
