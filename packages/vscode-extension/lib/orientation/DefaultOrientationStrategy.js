/**
 * Default orientation strategy using React Native core APIs.
 *
 * This fallback strategy uses UIManager events and DimensionsObserver to track orientation changes.
 * The approach has limitations due to lack of sync orientation getter in React Native core:
 *
 * Android: Orientation events fire after app rotation and are distinct from device orientation. In case of
 * android, the event fires on app start and can be relied on during the app lifecycle.
 *
 * iOS: Events fire when DEVICE rotates (based on sensors), not when APP rotates, creating not only
 * timing issues, but also firing events event when the application's UI is not rotated. This means
 * we cannot rely on the events entirely and the frontend must properly interpret the messages sent.
 *
 * To handle iOS limitations, we use DimensionsObserver for additional tracking and make assumptions
 * about supported orientations (e.g., portrait-secondary typically not supported).
 */

const { Platform, UIManager, NativeEventEmitter, NativeModules } = require("react-native");
const NativeUIManager = NativeModules.UIManager ?? UIManager;
const inspectorBridge = require("../inspector_bridge");
const DimensionsObserver = require("../dimensions_observer");

/**
 * Mapping from namedOrientationDidChangeEvent names to DeviceRotation names or "Landscape" specific case
 * sent to the extension.
 * "Landscape" and "Portrait" cases may happen when we cannot infer the detailed orientation of the app and
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
  // No previous namedOrientationDidChangeEvent fired
  // -> we only return partial information about the orientation
  // This is fine in the cases we can handle, because it only happens during intialization
  // and cases when the user forces app orientation programatically, without firing the event on iOS
  // and later if the orientation does not change, further messages with this state
  // are not sent to the extension.
  if (orientation === null) {
    return isLandscape ? "Landscape" : "Portrait";
  }

  if (Platform.OS === "ios") {
    // If the app is landscape and device is rotated to portrait-primary or portrait-secondary,
    // return the previous rotation
    if (
      isLandscape &&
      (orientation === "portrait-primary" || orientation === "portrait-secondary")
    ) {
      if (currentAppOrientation === "LandscapeLeft" || currentAppOrientation === "LandscapeRight") {
        return currentAppOrientation;
      } else {
        return "Landscape"; // fallback to Landscape, we have no means to determine the exact orientation
      }
    }

    if (
      !isLandscape &&
      (orientation === "landscape-primary" || orientation === "landscape-secondary")
    ) {
      if (currentAppOrientation === "Portrait" || currentAppOrientation === "PortraitUpsideDown") {
        return currentAppOrientation;
      } else {
        return "Portrait"; // fallback to Portrait, we have no means to determine the exact orientation
      }
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

function initializeOrientationAndSendInitMessage() {
  const { width: screenWidth, height: screenHeight } = DimensionsObserver.getScreenDimensions();
  const isLandscape = screenWidth > screenHeight;
  // infer currentOrientation based on the screen dimensions
  // android still fires the namedOrientationDidChangeEvent on app load,
  // but for safety still set it here first
  currentAppOrientation = isLandscape ? "Landscape" : "Portrait";
  inspectorBridge.sendMessage({
    type: "appOrientationChanged",
    data: currentAppOrientation,
  });
}

function updateOrientationAndSendMessage(orientation) {
  const { width: screenWidth, height: screenHeight } = DimensionsObserver.getScreenDimensions();
  const isLandscape = screenWidth > screenHeight;
  const mappedOrientation = getMappedOrientation(orientation, isLandscape);

  if (currentAppOrientation !== mappedOrientation) {
    currentAppOrientation = mappedOrientation;
    inspectorBridge.sendMessage({
      type: "appOrientationChanged",
      data: mappedOrientation,
    });
  }
}

function setupOrientationListener(callback) {
  // Define callbacks inside the setup, in order for dimensionsObserver to be able
  // to properly differentiate between created functions
  const handleOrientationChange = ({ name: orientation }) => {
    lastRegisteredOrientation = orientation;
    updateOrientationAndSendMessage(orientation);
    if (callback) {
      callback(orientation);
    }
  };

  // Fire additionally on Dimensions change because of iOS "lag" issue described
  // in the above context.
  const handleDimensionsChange = () => {
    updateOrientationAndSendMessage(lastRegisteredOrientation);
    if (callback) {
      callback(lastRegisteredOrientation);
    }
  };

  // Suppress warnings about UIManager not implementing proper methods by overwriting console.warn temporarily.
  // This is needed, because UIManager.addListener and UIManager.removeListeners methods
  // are undefined. When the same trick is applied to those methods (overwriting and assigning the original
  // methods later), we begin to get Render and Console errors in LogBox after the assignment:
  // "_this$_nativeModule2.removeListeners is not a function (it is undefined)"
  const originalConsoleWarn = console.warn;
  console.warn = () => {};

  const orientationEventSubscription = new NativeEventEmitter(NativeUIManager).addListener(
    "namedOrientationDidChange",
    handleOrientationChange
  );

  // Dimension change lags behind Orientation change in the IOS case, so we add a second listener to amend the effect.
  // Explained in the context above.
  const dimensionsChangeSubscription = DimensionsObserver.addListener(handleDimensionsChange);

  // Restore the original console.warn function
  console.warn = originalConsoleWarn;

  return function cleanup() {
    if (orientationEventSubscription) {
      orientationEventSubscription.remove();
    }
    // Remove layout change listener using subscription
    if (dimensionsChangeSubscription) {
      dimensionsChangeSubscription.remove();
    }
  };
}

export function getStrategy() {
  return {
    initializeOrientationAndSendInitMessage,
    updateOrientationAndSendMessage,
    setupOrientationListener,
  };
}
