const { Dimensions, AppState, Platform } = require("react-native");
const inspectorBridge = require("./inspector_bridge");

// Below module is used to determine whether we should make
// inspector-and-alike overlays available, as they exhibit
// unexpected behavior when the app is not edge-to-edge, because
// of margins, which are unavailable to fetch using react-native API.

const INSPECTOR_AVAILABLE_STATUS = "available"
const INSPECTOR_UNAVAILABLE_EDGE_TO_EDGE_STATUS =  "unavailableEdgeToEdge"
const INSPECTOR_UNAVAILABLE_INACTIVE_STATUS = "unavailableInactive"

let isAppStateActive = true;
let isEdgeToEdge = true;
let isFocused = true;
let lastEstablishedAvailability = null;

const updateAvailabilityAndSendMessage = () => {

  let availabilityStatus = INSPECTOR_AVAILABLE_STATUS;
  if (!isEdgeToEdge) {
    availabilityStatus = INSPECTOR_UNAVAILABLE_EDGE_TO_EDGE_STATUS;
  }
  if (!isAppStateActive || !isFocused) {
    availabilityStatus = INSPECTOR_UNAVAILABLE_INACTIVE_STATUS;
  }

  if (availabilityStatus !== lastEstablishedAvailability) {
    lastEstablishedAvailability = availabilityStatus;
    inspectorBridge.sendMessage({
      type: "inspectorAvailabilityChanged",
      data: availabilityStatus,
    });
  }
};

const handleDimensionsChange = () => {
  // Despite Dimensions API being bugged on iPads, it still provides
  // the dimensions of the screen and window in the same orientation state
  // between the two, so for comparison purposes we can use it to determine
  // whether the app is edge-to-edge or not.
  const { width: screenWidth, height: screenHeight } = Dimensions.get("screen");
  const { width: windowWidth, height: windowHeight } = Dimensions.get("window");

  isEdgeToEdge = screenWidth === windowWidth && screenHeight === windowHeight;
  updateAvailabilityAndSendMessage();
};

const handleAppStateChange = (appState) => {
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
    // The `focus` and `blur` events are separate from `change` event and from the app state.
    // On android the app state remains active in situations where on iPad it would become inactive -
    // that is when the app switcher is used, notification drawer is pulled, etc.
    // Upon these actions on android `blur` and `focus` events are fired, which
    // do not change the app state but allow for detecting such situations. More on that:
    // https://reactnative.dev/docs/appstate

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
