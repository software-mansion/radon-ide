const inspectorBridge = require("../inspector_bridge");
let ExpoOrientation;

try {
  ExpoOrientation = require("expo-screen-orientation");
  // Verify whether the import is correct and exposes one of the functions
  if (!ExpoOrientation.getOrientationAsync) {
    ExpoOrientation = null;
  }
} catch {
  // Library not available
  ExpoOrientation = null;
}

let currentAppOrientation = null;

/**
 * Maps Expo orientation constants to app orientation strings.
 * @param {number} expoOrientation - Expo orientation constant
 * @returns {string} App orientation string
 */
const mapExpoOrientationToAppOrientation = (expoOrientation) => {
  switch (expoOrientation) {
    // Landscape Left and Right are swapped, this is no mistake
    case ExpoOrientation.Orientation.LANDSCAPE_RIGHT:
      return "LandscapeLeft";
    case ExpoOrientation.Orientation.LANDSCAPE_LEFT:
      return "LandscapeRight";
    case ExpoOrientation.Orientation.PORTRAIT_DOWN:
      return "PortraitUpsideDown";
    default:
    case ExpoOrientation.Orientation.PORTRAIT_UP:
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
  function handleOrientationChange(event) {
    updateOrientationAndSendMessage(event.orientationInfo);
    if (callback) {
      callback(event.orientationInfo);
    }
  }

  const subscription = ExpoOrientation.addOrientationChangeListener(handleOrientationChange);

  return function cleanup() {
    if (subscription) {
      subscription.remove();
    }
  };
}

if (!ExpoOrientation) {
  module.exports = undefined;
} else {
  module.exports = {
    getStrategy() {
      return {
        initializeOrientationAndSendInitMessage,
        updateOrientationAndSendMessage,
        setupOrientationListener,
      };
    },
  };
}
