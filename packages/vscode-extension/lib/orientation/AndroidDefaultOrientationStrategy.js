/**
 * Default orientation strategy using React Native core APIs.
 *
 * This strategy uses UIManager events to track orientation changes.
 *
 * On Android, orientation events fire after app rotation and are distinct from device orientation. In case of
 * android, the event fires on app start and can be relied on during the app lifecycle.
 */

const { UIManager, NativeEventEmitter, NativeModules } = require("react-native");
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

/**
 * The function is used to map the orientation to a common format
 * used by the AppOrientation in the extension, as the landscape orientation
 * from the eventListener object is different on iOS and Android.
 * Android -> "landscape-primary" === LandscapeRight
 */
const getMappedOrientation = (orientation) => {
  return androidOrientationMapping[orientation] ?? "Portrait";
};

function initializeOrientationAndSendInitMessage() {
  const { width: screenWidth, height: screenHeight } = DimensionsObserver.getScreenDimensions();
  const isLandscape = screenWidth > screenHeight;
  // infer currentOrientation based on the screen dimensions
  // android still fires the namedOrientationDidChangeEvent on app load
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
    updateOrientationAndSendMessage(orientation);
    if (callback) {
      callback(orientation);
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

  // Restore the original console.warn function
  console.warn = originalConsoleWarn;

  return function cleanup() {
    if (orientationEventSubscription) {
      orientationEventSubscription.remove();
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
