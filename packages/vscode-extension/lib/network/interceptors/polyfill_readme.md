# React Native Fetch Polyfill Interceptor

## Overview

The `PolyfillFetchInterceptor` is made to intercept network requests made using the [`react-native-fetch-api`](https://github.com/react-native-community/fetch) polyfill package in React Native applications, as the network requests using this dependency are made using `Networking` native module instead of relying on RN's `XHR` implementation - thus they are impossible to intercept using `XHRInterceptor`.

The interceptor hooks into the polyfill's internal lifecycle methods to capture network activity and report it using messages compliant to the foregoing implementation using `XHRInterceptor`.

## Innerworks of react-native-fetch-api

[`react-native-fetch-api`](https://github.com/react-native-community/fetch) overwrites the `global.fetch` function with its implementation based on [`Fetch.js`](https://github.com/react-native-community/fetch/blob/master/src/Fetch.js) class, which is used like this (see [here](https://github.com/react-native-community/fetch/blob/master/fetch.js)):

```js
import Fetch from "./src/Fetch";

// ...

const fetch = (resource, options) => new Fetch(resource, options);
```

The class itself is main orchestrator that:

- Uses React Native's `Networking.sendRequest()` to make network requests
- Subscribes to native network events via `Networking.addListener()`
- Wraps Requests and Response objects with additional attributes
- Allows for streaming support
- Implements abort functionality via signals

Because this implementation is made via a class, there exist internal methods that fire during the network request lifecycle and which can be monkey-patched to intercept the data flowing. The lifecycle looks as follows:

```
1. __didCreateRequest(requestId)
   ↓
2. __didReceiveNetworkResponse(requestId, status, headers, url)
   ↓
3a. __didReceiveNetworkIncrementalData(requestId, responseText, progress, total)
    [Called multiple times for streaming responses when nativeResponseType is "text"]
   OR
3b. __didReceiveNetworkData(requestId, response)
    [Called once for blob/base64 responses]
   ↓
4. __didCompleteNetworkResponse(requestId, errorMessage, didTimeOut)
```

Additionally:

```
__abort()
[Called when request is cancelled]
```

The interceptor uses prototype modification to wrap the original polyfill methods:

```typescript
// saving original implementation
const self = this;
self.original__didCreateRequest = Fetch.prototype.__didCreateRequest;

// replace with wrapped version
Fetch.prototype.__didCreateRequest = function (requestId: number) {
  self.original__didCreateRequest.call(this, requestId);

  // extract the request data nd make needed transformations

  self.sendCDPMessage("Network.METHOD", { ... });
};
```

It is important to note, that this interceptor should be initialised and enabled together with original `XHRInterceptor` as the user may still make requests by using XHR explicitly or using axios - this approach does not allow for intercepting such messages.

The interceptor shares the `AsyncBoundedResponseBuffer` for storing responses data with XHR interceptor.

## Incremental Response Handling

For streaming responses (when `nativeResponseType` is `"text"`), the interceptor uses an `IncrementalResponseQueue` to accumulate response chunks:

- Each chunk arrives as a string via `__didReceiveNetworkIncrementalData`
- Chunks are encoded to `Uint8Array` using `TextEncoder` (matching polyfill's internal behavior,
  preserves multi-byte character boundaries and allows proper base64 encoding for binary responses.)
- Accumulated chunks are stored per request ID until completion
- On `__didCompleteNetworkResponse`, all chunks are combined and processed based on content type
- Queue is cleared after successful buffering or on errors/abort

## Native Response Types

The polyfill supports three response types:

##### 1. `"text"` (Streaming)

- Enables streaming and `__didReceiveNetworkIncrementalData` callbacks
- Response arrives in chunks via `responseText`
- Used when `{reactNative: {streaming: true}}` or `{reactNative: {_nativeResponseType: "text"}}` is provided as additional fetch argument
- Creates a ReadableStream that's progressively filled

##### 2. `"blob"`

- Response arrives as a Blob object
- This response type is set by default in all responses
- Single `__didReceiveNetworkData` callback

##### 3. `"base64"`

- Response arrives as base64-encoded arrayBuffer
- Set only when user explicitly provides `{reactNative: {_nativeResponseType: "base64"}}` as configuration object in fetch
- Single `__didReceiveNetworkData` callback
