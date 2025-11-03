# Steps to Enable Experimental Network Inspector Backend

1. Modify files in the react-native directory used by the project (can be `node_modules/react-native`):

   - `react-native/src/private/featureflags/ReactNativeFeatureFlags.js` - set the following flags to true
     ```ts
     //...
     export const enableNetworkEventReporting: Getter<boolean> = createNativeFlagGetter(
       "enableNetworkEventReporting",
       true
     );
     //...
     export const fuseboxNetworkInspectionEnabled: Getter<boolean> = createNativeFlagGetter(
       "fuseboxNetworkInspectionEnabled",
       true
     );
     //...
     export const enableBridgelessArchitecture: Getter<boolean> = createNativeFlagGetter(
       "enableBridgelessArchitecture",
       true
     );
     //...
     export const enableResourceTimingAPI: Getter<boolean> = createNativeFlagGetter(
       "enableResourceTimingAPI",
       true
     );
     //...
     ```
   - `react-native/ReactCommon/react/featureflags/ReactNativeFeatureFlags.cpp` - set the following methods to always return true:
     ```cpp
     //...
     bool ReactNativeFeatureFlags::enableBridgelessArchitecture() {
        // return getAccessor().enableBridgelessArchitecture();
        return true;
     }
     //...
     bool ReactNativeFeatureFlags::enableNetworkEventReporting() {
        // return getAccessor().enableNetworkEventReporting();
        return true;
     }
     //...
     bool ReactNativeFeatureFlags::enableResourceTimingAPI() {
        // return getAccessor().enableResourceTimingAPI();
        return true;
     }
     //...
     bool ReactNativeFeatureFlags::fuseboxNetworkInspectionEnabled() {
        // return getAccessor().fuseboxNetworkInspectionEnabled();
        return true;
     }
     //...
     ```

2. Add an argument to the XcodeBuild command:
   ```sh
   OTHER_CFLAGS="-DREACT_NATIVE_DEBUGGER_ENABLED=1"
   ```
   If using ReactNativeCLI, you may execute this command:
   ```sh
    npx react-native run-ios --extra-params OTHER_CFLAGS="-DREACT_NATIVE_DEBUGGER_ENABLED=1"
   ```

The experimental network inspector should now be enabled on IOS device. The user must send message with method `Network.enable` command through debugger web socket connection to enable network request recording:

```ts
{method: "Network.enable", params: {}}
```

The network request are all also sent through the debugger web socket connection. The connection can be found by quering endpoint: `http://localhost:METRO_PORT/json`

3. To enablen new inspector support in network-plugin set the flag:

```ts
ENABLE_NEW_INSPECTOR = true;
```

--- 

## Supported CDP Methods, Types and Events in the fusebox network inspector in React Native 82 implementation:

### Network Domain

### Methods

#### `Network.enable`
Enables network tracking.
- **Parameters**: None
- **Returns**: `{}`

#### `Network.disable`
Disables network tracking.
- **Parameters**: None
- **Returns**: `{}`

#### `Network.getResponseBody`
Returns content served for the given request.
- **Parameters**:
  - `requestId` (string): Identifier of the network request to get content for
- **Returns**:
  - `body` (string): Response body
  - `base64Encoded` (boolean): True if content was sent as base64

#### `Network.loadNetworkResource`
Fetches the resource and returns content served for the given URL.
- **Parameters**:
  - `url` (string): URL of the resource to load
- **Returns**:
  - `success` (boolean): Whether the request was successful
  - `stream` (string, optional): Stream handle for reading response data
  - `httpStatusCode` (number, optional): HTTP status code
  - `headers` (Headers, optional): Response headers
  - `netErrorName` (string, optional): Network error name if failed

### Events

#### `Network.requestWillBeSent`
Fired when page is about to send HTTP request.
- **Parameters**:
  - `requestId` (string): Request identifier
  - `loaderId` (string): Loader identifier
  - `documentURL` (string): Document URL (set to "mobile" in RN)
  - `request` (Request): Request data
  - `timestamp` (number): Timestamp (Unix epoch with µs precision)
  - `wallTime` (number): Wall time (Unix epoch with µs precision)
  - `initiator` (object): Request initiator (set to `{type: "script"}`)
  - `redirectHasExtraInfo` (boolean): Whether redirect response has extra info
  - `redirectResponse` (Response, optional): Redirect response data

#### `Network.requestWillBeSentExtraInfo`
Fired when additional information about request is available.
- **Parameters**:
  - `requestId` (string): Request identifier
  - `associatedCookies` (array): Associated cookies (always empty in RN)
  - `headers` (Headers): Request headers
  - `connectTiming` (ConnectTiming): Connection timing information

#### `Network.responseReceived`
Fired when HTTP response is available.
- **Parameters**:
  - `requestId` (string): Request identifier
  - `loaderId` (string): Loader identifier
  - `timestamp` (number): Timestamp (Unix epoch with µs precision)
  - `type` (ResourceType): Resource type
  - `response` (Response): Response data
  - `hasExtraInfo` (boolean): Whether response has extra info (always false in RN)

#### `Network.dataReceived`
Fired when data chunk was received over the network.
- **Parameters**:
  - `requestId` (string): Request identifier
  - `timestamp` (number): Timestamp (Unix epoch with µs precision)
  - `dataLength` (number): Data chunk length
  - `encodedDataLength` (number): Actual bytes received (compressed)

#### `Network.loadingFinished`
Fired when HTTP request has finished loading.
- **Parameters**:
  - `requestId` (string): Request identifier
  - `timestamp` (number): Timestamp (Unix epoch with milisec precision)
  - `encodedDataLength` (number): Total encoded data length

#### `Network.loadingFailed`
Fired when HTTP request has failed to load.
- **Parameters**:
  - `requestId` (string): Request identifier
  - `timestamp` (number): Timestamp (Unix epoch with µs precision)
  - `type` (ResourceType): Resource type
  - `errorText` (string): Error message ("net::ERR_ABORTED" or "net::ERR_FAILED")
  - `canceled` (boolean): True if request was canceled

### Types

#### `Request`
HTTP request data.
- `url` (string): Request URL
- `method` (string): HTTP method
- `headers` (Headers): Request headers
- `postData` (string, optional): POST data

#### `Response`
HTTP response data.
- `url` (string): Response URL
- `status` (number): HTTP status code
- `statusText` (string): HTTP status text
- `headers` (Headers): Response headers
- `mimeType` (string): MIME type from Content-Type header
- `encodedDataLength` (number): Total encoded data length

#### `Headers`
Request/response headers as key-value pairs.
- Type: `object` (map of string to string)

#### `ConnectTiming`
Connection timing information.
- `requestTime` (number): Timing relative to request start

#### `ResourceType`
Resource type as detected by MIME type.
- Supported values:
  - `"Image"` - for `image/*` MIME types
  - `"Media"` - for `audio/*` and `video/*` MIME types
  - `"Script"` - for JavaScript MIME types
  - `"XHR"` - for JSON/XML MIME types
  - `"Other"` - default/fallback

---

### IO Domain

### Methods (Commands)

#### `IO.read`
Read a chunk of the stream.
- **Parameters**:
  - `handle` (string): Handle of the stream to read
  - `size` (number, optional): Number of bytes to read (max: 10MB, default: configurable)
- **Returns**:
  - `data` (string): Data read from stream
  - `eof` (boolean): Set if end-of-stream reached
  - `base64Encoded` (boolean): True if data is base64-encoded

#### `IO.close`
Close the stream, discard any temporary backing storage.
- **Parameters**:
  - `handle` (string): Handle of the stream to close
- **Returns**: `{}`