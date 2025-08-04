const { Dimensions, AppState, Platform } = require("react-native");
const inspectorBridge = require("./inspector_bridge");

// Below module is used to determine whether we should make
// inspector-and-alike overlays available, as they exhibit
// unexpected behavior when the app is not edge-to-edge, because
// of margins, which are unavailable to fetch using react-native API.

let isAppStateActive = true;
let isEdgeToEdge = true;
let isFocused = true;
let lastEstablishedAvailability = null;

const updateAvailabilityAndSendMessage = () => {
  const availability = isAppStateActive && isEdgeToEdge && isFocused;

  if (availability !== lastEstablishedAvailability) {
    lastEstablishedAvailability = availability;
    inspectorBridge.sendMessage({
      type: "inspectorAvailabilityChanged",
      data: availability,
    });
  }
};

const handleDimensionsChange = () => {
  const { width: screenWidth, height: screenHeight } = Dimensions.get("screen");
  const { width: windowWidth, height: windowHeight } = Dimensions.get("window");
  isEdgeToEdge = screenWidth === windowWidth && screenHeight === windowHeight;
  updateAvailabilityAndSendMessage();
};

const handleAppStateChange = (appState) => {
  console.log("App state changed:", appState);
  isAppStateActive = appState === "active";
  updateAvailabilityAndSendMessage();
};

const handleBlurChange = () => {
  isFocused = false;
  updateAvailabilityAndSendMessage();
};

const handleFocusChange = () => {
  isFocused = true;
  updateAvailabilityAndSendMessage();
};

const initializeInspectorAvailability = () => {
  const { width: screenWidth, height: screenHeight } = Dimensions.get("screen");
  const { width: windowWidth, height: windowHeight } = Dimensions.get("window");
  isEdgeToEdge = screenWidth === windowWidth && screenHeight === windowHeight;
  isAppStateActive = AppState.currentState === "active";
  updateAvailabilityAndSendMessage();
};

export function setup() {
  initializeInspectorAvailability();

  let appBlurSubscription = null;
  let appFocusSubscription = null;

  const dimensionEventSubscription = Dimensions.addEventListener("change", handleDimensionsChange);
  const appStateSubscription = AppState.addEventListener("change", handleAppStateChange);

  // iOS does not support "blur" and "focus" events on AppState
  if (Platform.OS === "android") {
    appBlurSubscription = AppState.addEventListener("blur", handleBlurChange);
    appFocusSubscription = AppState.addEventListener("focus", handleFocusChange);
  }

  return function cleanup() {
    if (dimensionEventSubscription) {
      dimensionEventSubscription.remove();
    }
    if (appStateSubscription) {
      appStateSubscription.remove();
    }

    if (appBlurSubscription) {
      appBlurSubscription.remove();
    }
    if (appFocusSubscription) {
      appFocusSubscription.remove();
    }
  };
}
