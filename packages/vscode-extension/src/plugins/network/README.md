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


