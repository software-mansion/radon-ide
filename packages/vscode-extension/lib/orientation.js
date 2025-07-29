const { Dimensions, Platform, UIManager, NativeEventEmitter } = require("react-native");
const inspectorBridge = require("./inspector_bridge");


// The approach implemented below is best we can do as of today, becuase of lack
// of support for orientation getter sync requests in the React Native core.
// Hence, the orientation is determined by the event listener via NativeEventEmitter(UIManager)
// and the Dimensions API, which is not 100% reliable and works differently across platforms.

// The orientation events on Android work as one would expect - the orientation change
// is reported after the app actually rotates and is distinct from the device orientation.
// The event is fired on the first app load and every time the orientation changes.
// If orientation is not supported by the app (the app is not rotated when the device rotates, for example),
// the orientation change is not reported.

// On iOS, the orientation events are fired when the DEVICE ROTATES, because the API is based on device sensors.
// Hence, orientation change event is not fired when the app starts,
// and the app's initial orientation is not known until the first rotation occurs - this
// is why we need to use the Dimensions API and appOrientationInit to properly handle it on the frontend.
// Additionally, when app does not support given orientation, the event still fires (new orientation is reported
// even though the app remains in previous mode, only because the device was rotated). This is why, we need to
// infer information about the app's orientation based on the device orientation and ASSUME THAT PORTRAIT-SECONDARY IS NOT SET.
// We also assume that, if one of the landscape orientations is supported, the other one is supported as well.

// For IOS the orientation event is fired after the DEVICE rotates, but before the APP actually rotates.
// This means, we are experiencing a lag between current orientation and information from Dimensions API,
// which is why additional listener is added to the Dimensions API to amend the effect.

/**
 * Mapping from namedOrientationDidChangeEvent names to DeviceRotation names or "Landscape" specific case
 * sent to the extension.
 * "Landscape" case happens when we cannot infer the detailed landscape orientation of the app and
 * leave the interpretation to the frontend of the extension.
 */
const androidOrientationMapping = {
  "portrait-primary": "Portrait",
  "portrait-secondary": "PortraitUpsideDown",
  "landscape-primary": "LandscapeLeft",
  "landscape-secondary": "LandscapeRight",
};

let currentAppOrientation = null;
let lastRegisteredOrientation = null;

/**
 * The function is used to map the orientation to a common format
 * used by the AppOrientation in the extension, as the landscape orientation
 * from the eventListener object is different on iOS and Android.
 * iOs -> "landscape-secondary" === LandscapeLeft
 * Android -> "landscape-primary" === LandscapeRight
 */
const getMappedOrientation = (orientation, isLandscape) => {
  if (Platform.OS === "ios") {
    // If the app is not Landscape, then we always wish to return "Portrait"
    // because the app is not rotated and no matter the device rotation
    if (!isLandscape) {
      return "Portrait";
    }

    // If the app is landscape and device is rotated to portrait-primary or portrait-secondary,
    // return the previous rotation
    if (
      isLandscape &&
      (orientation === "portrait-primary" || orientation === "portrait-secondary")
    ) {
      return currentAppOrientation;
    }

    // No previous namedOrientationDidChangeEvent fired
    // -> we only return partial information about the orientation
    // This is fine in the cases we can handle, because it only happens during intialization
    // and cases when the user forces app orientation programatically, without firing the event on iOS
    // and later if the orientation does not change, further messages with this state
    // are not sent to the extension.
    if (orientation === null) {
      return isLandscape ? "Landscape" : "Portrait";
    }

    // for ios landscape-secondary -> LandscapeLeft
    if (orientation === "landscape-secondary") {
      return "LandscapeLeft";
    }

    // for ios landscape-primary -> LandscapeRight
    if (orientation === "landscape-primary") {
      return "LandscapeRight";
    }
  }

  // for android simply return the mapping
  return androidOrientationMapping[orientation];
};

// send message to the extension with the information whether the app is in landscape mode or not.
// This is used to infer the initial orientation of the app, due to IOS limitations.
const initializeOrientationAndSendInitMessage = () => {
  const { width: screenWidth, height: screenHeight } = Dimensions.get("screen");
  const isLandscape = screenWidth > screenHeight;

  // infer currentOrientation based on the screen dimensions
  // android still fires the namedOrientationDidChangeEvent on app load,
  // but for safety still set it here first
  currentAppOrientation = isLandscape ? "Landscape" : "Portrait";
  inspectorBridge.sendMessage({
    type: "appOrientationChanged",
    data: currentAppOrientation,
  });
};

const updateOrientationAndSendMessage = (orientation) => {
  const { width: screenWidth, height: screenHeight } = Dimensions.get("screen");

  const isLandscape = screenWidth > screenHeight;
  const mappedOrientation = getMappedOrientation(orientation, isLandscape);
  if (currentAppOrientation !== mappedOrientation) {
    currentAppOrientation = mappedOrientation;
    inspectorBridge.sendMessage({
      type: "appOrientationChanged",
      data: mappedOrientation,
    });
  }
};

const handleOrientationChange = ({ name: orientation }) => {
  lastRegisteredOrientation = orientation;
  updateOrientationAndSendMessage(orientation);
};

// Fire additionally on Dimensions change because of iOS "lag" issue described
// in the above context.
const handleDimensionsChange = () => {
  updateOrientationAndSendMessage(lastRegisteredOrientation);
};

export function setup() {
  initializeOrientationAndSendInitMessage();

  // Suppress warnings about UIManager not implementing proper methods by overwriting console.warn temporarily.
  // This is needed, because UIManager.addListener and UIManager.removeListeners methods
  // are undefined. When the same trick is applied to those methods (overwriting and assigning the original 
  // methods later), we begin to get Render and Console errors in LogBox after the assignment:
  // "_this$_nativeModule2.removeListeners is not a function (it is undefined)"
  const originalConsoleWarn = console.warn;
  console.warn = () => {};

  const orientationEventSubscription = new NativeEventEmitter(UIManager).addListener(
    "namedOrientationDidChange",
    handleOrientationChange
  );

  // Dimension change lags behind Orientation change in the IOS case, so we add a second listener to amend the effect.
  // Explained in the context above.
  const dimensionEventSubscription = Dimensions.addEventListener("change", handleDimensionsChange);

  // Restore the original console.warn function
  console.warn = originalConsoleWarn; 

  return function cleanup() {
    if (orientationEventSubscription) {
      orientationEventSubscription.remove();
    }
    if (dimensionEventSubscription) {
      dimensionEventSubscription.remove();
    }
  };
}
