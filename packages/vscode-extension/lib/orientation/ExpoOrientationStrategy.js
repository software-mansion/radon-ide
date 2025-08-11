const inspectorBridge = require("../inspector_bridge");
let ExpoOrientation;

try {
  ExpoOrientation = require("expo-screen-orientation");
} catch {
  // Library not available
}

/**
 * Checks if expo-screen-orientation library is available.
 * @returns {boolean} true if library is available, false otherwise
 */
export function isStrategyAvailable() {
  return !!ExpoOrientation.getOrientationAsync;
}

let currentAppOrientation = null;

/**
 * Maps Expo orientation constants to app orientation strings.
 * @param {number} expoOrientation - Expo orientation constant
 * @returns {string} App orientation string
 */
const mapExpoOrientationToAppOrientation = (expoOrientation) => {
  switch (expoOrientation) {
    case ExpoOrientation.Orientation.PORTRAIT_UP:
      return "Portrait";
    case ExpoOrientation.Orientation.PORTRAIT_DOWN:
      return "PortraitUpsideDown";
    case ExpoOrientation.Orientation.LANDSCAPE_RIGHT:
      return "LandscapeLeft";
    case ExpoOrientation.Orientation.LANDSCAPE_LEFT:
      return "LandscapeRight";
    default:
      return "Portrait"; // fallback
  }
};

function initializeOrientationAndSendInitMessage() {
  ExpoOrientation.getOrientationAsync()
    .then((orientationInfo) => {
      currentAppOrientation = mapExpoOrientationToAppOrientation(orientationInfo.orientation);
      inspectorBridge.sendMessage({
        type: "appOrientationChanged",
        data: currentAppOrientation,
      });
    })
    .catch(() => {
      // Fallback to portrait if unable to get orientation
      currentAppOrientation = "Portrait";
      inspectorBridge.sendMessage({
        type: "appOrientationChanged",
        data: currentAppOrientation,
      });
    });
}

function updateOrientationAndSendMessage(orientationInfo) {
  const mappedOrientation = mapExpoOrientationToAppOrientation(orientationInfo.orientation);
  
  if (currentAppOrientation !== mappedOrientation) {
    currentAppOrientation = mappedOrientation;
    inspectorBridge.sendMessage({
      type: "appOrientationChanged",
      data: mappedOrientation,
    });
  }
}

function setupOrientationListener(callback) {
  const subscription = ExpoOrientation.addOrientationChangeListener((event) => {
    updateOrientationAndSendMessage(event.orientationInfo);
    if (callback) {
      callback(event.orientationInfo);
    }
  });

  return function cleanup() {
    if (subscription) {
      subscription.remove();
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
