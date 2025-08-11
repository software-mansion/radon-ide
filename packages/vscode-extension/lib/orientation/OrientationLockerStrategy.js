const inspectorBridge = require("../inspector_bridge");

let OrientationLocker;
// let OrientationLockerConstants;

try {
    OrientationLocker = require("react-native-orientation-locker").default;
} catch {
    // Library not available
}

/**
 * Checks if react-native-orientation-locker library is available.
 * @returns {boolean} true if library is available, false otherwise
 */
export function isStrategyAvailable() {
  return !!OrientationLocker.getOrientation;
}

let currentAppOrientation = null;

/**
 * Maps OrientationLocker orientation strings to app orientation strings.
 * @param {string} orientation - OrientationLocker orientation string
 * @returns {string} App orientation string
 */
const mapOrientationLockerToAppOrientation = (orientation) => {
  switch (orientation) {
    case "PORTRAIT":
      return "Portrait";
    case "PORTRAIT-UPSIDEDOWN":
      return "PortraitUpsideDown";
    case "LANDSCAPE-LEFT":
      return "LandscapeLeft";
    case "LANDSCAPE-RIGHT":
      return "LandscapeRight";
    default:
      return "Portrait"; // fallback
  }
};

function initializeOrientationAndSendInitMessage() {
  OrientationLocker.getOrientation((orientation) => {
    currentAppOrientation = mapOrientationLockerToAppOrientation(orientation);
    inspectorBridge.sendMessage({
      type: "appOrientationChanged",
      data: currentAppOrientation,
    });
  });
}

function updateOrientationAndSendMessage(orientation) {
  const mappedOrientation = mapOrientationLockerToAppOrientation(orientation);
  
  if (currentAppOrientation !== mappedOrientation) {
    currentAppOrientation = mappedOrientation;
    inspectorBridge.sendMessage({
      type: "appOrientationChanged",
      data: currentAppOrientation,
    });
  }
}

function setupOrientationListener(callback) {
  const handleOrientationChange = (orientation) => {
    updateOrientationAndSendMessage(orientation);
    if (callback) {
      callback(orientation);
    }
  };

  // Add orientation listener
  OrientationLocker.addOrientationListener(handleOrientationChange);

  return function cleanup() {
    OrientationLocker.removeOrientationListener(handleOrientationChange);
  };
}

export function getStrategy() {
  return {
    initializeOrientationAndSendInitMessage,
    updateOrientationAndSendMessage,
    setupOrientationListener,
  };
}