const { Platform, UIManager, NativeEventEmitter, NativeModules } = require("react-native");
const inspectorBridge = require("../inspector_bridge");
const NativeUIManager = NativeModules.UIManager ?? UIManager;

let OrientationLocker;

try {
  OrientationLocker = require("react-native-orientation-locker").default;
  // Verify whether the import is correct and exposes one of the functions
  if (!OrientationLocker.getOrientation) {
    OrientationLocker = null;
  }
} catch {
  // Library not available
  OrientationLocker = null;
}

const androidOrientationMapping = {
  "portrait-primary": "Portrait",
  "portrait-secondary": "PortraitUpsideDown",
  "landscape-primary": "LandscapeLeft",
  "landscape-secondary": "LandscapeRight",
};

const iosOrientationMapping = {
  "LANDSCAPE-LEFT": "LandscapeLeft",
  "LANDSCAPE-RIGHT": "LandscapeRight",
  "PORTRAIT-UPSIDEDOWN": "PortraitUpsideDown",
  "PORTRAIT": "Portrait",
};

let currentAppOrientation = null;

/**
 * Maps OrientationLocker orientation strings to app orientation strings.
 * @param {string} orientation - OrientationLocker orientation string
 * @returns {string} App orientation string
 */
const mapOrientationLockerToAppOrientation = (orientation) => {
  const mappedOrientation =
    Platform.OS === "ios"
      ? iosOrientationMapping[orientation]
      : androidOrientationMapping[orientation];
  return mappedOrientation || "Portrait"; // Fallback to Portrait if mapping fails
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

  if (Platform.OS === "ios") {
    // on iOS orientation-locker can be relied upon
    OrientationLocker.addOrientationListener(handleOrientationChange);

    return function cleanup() {
      OrientationLocker.removeOrientationListener(handleOrientationChange);
    };
  } else {
    // on Android, native event emitter is used, because orientation-locker
    // lags behind recording the orientation
    const orientationEventSubscription = new NativeEventEmitter(NativeUIManager).addListener(
      "namedOrientationDidChange",
      ({ name: orientation }) => {
        handleOrientationChange(orientation);
      }
    );

    return function cleanup() {
      orientationEventSubscription.remove();
    };
  }
}

if (!OrientationLocker) {
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
